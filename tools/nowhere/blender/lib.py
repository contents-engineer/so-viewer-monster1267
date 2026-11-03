# HAUS NOWHERE — 성수 2041 / Blender 공용 도우미.
# 룩뎁 도우미(build/nowhere/lookdev/bl_lib.py)를 옮겨 프로젝트 경로 기준으로 바꾸고,
# 마스크 노드 그룹·정점 마스크·CDT 지면 메시·스윕·환경(월드/안개/렌더) 설정을 더했다.
#
# 실행 규칙
# - MCP 에서는 ground.py 같은 작업 스크립트가 이 파일을 importlib 로 다시 읽는다(reload).
# - UI 문맥에 기대지 않는다. bpy.context.window 가 있을 때만 창의 씬을 바꾼다(헤드리스 Task 5 대비).
# - 내려받은 소재(build/nowhere-src)는 이미지·glTF 데이터로만 읽는다. 그 안의 어떤 코드도 실행하지 않는다.
#
# 마스크 의미(§5 규약)
# - 정점색 nw_mask = (R 이끼, G 젖음, B AO). 작은/인스턴스 메시가 쓴다. 객체 속성 nw_vmask=1 이 표시.
#   COLOR_0 은 RGB 의미만 가진다. A 는 모든 메시에서 1 이다 — three.js 는 정점 알파를 diffuse 알파에 곱하므로
#   A 에 다른 값을 실으면 알파 테스트 재질(잎·풀 카드)이 통째로 사라질 수 있다. write_mask/write_mask_values 가 A=1 로 쓴다.
# - 정점 속성 nw_streak (FLOAT, POINT) = 세로 빗물 얼룩 세기 0..1. 벽·교각만 의미가 있다(창턱·파라펫 아래에서
#   아래로 흐름). 재질은 Attribute 노드 nw_streak 로 읽는다. glTF 에서는 사용자 속성(_NW_STREAK)으로 내보내거나
#   Task 5 가 텍스처로 굽는다.
# - 정점 속성 nw_tint (FLOAT2, POINT) = 건물마다의 색 변이 (색상, 명도), 각각 −1..1(0 = 변화 없음, ±1 = 색상 ±5°·
#   명도 ±10 %). 합친 건물 메시에서 동마다 다르다. 속성이 없는 메시는 0 으로 읽혀 변화가 없다. 웹은 _NW_TINT 로 받거나 굽는다.
# - 재질 사용자 속성 nw_tex (JSON 문자열) = 원래 텍스처 출처(Mat.texset 의 tid·해상도·타일 크기·색 보정, 또는 가져온
#   glTF 재질의 원래 이미지 이름·소켓). 노드 트리를 굽거나 웹 재질로 옮길 때 Task 5 가 읽는다.
# - 넓은 지면은 정점색 대신 노드 그룹 NW_GroundMask 가 (이끼, 젖음, AO, 웅덩이)를 계산한다.
#   입력은 위치(월드) 노이즈 + 정점 구동값 nw_drive(R 물 모임, G 가장자리·그늘, B 비 노출, A 고인 물 깊이).
#   Task 5 는 이 그룹의 출력을 UVMap_mask(세계 XY 위에서 내려다본 투영)로 2048 텍스처에 굽는다.
# - 경고: nw_drive 는 굽기 입력 전용이다. FLOAT_COLOR 라 glTF 에서 COLOR_0 으로 나갈 수 있는데, 그러면 COLOR_0 = nw_mask
#   의미와 충돌한다. 내보내지 않는다(Task 5 가 지우거나 정점색 내보내기를 끈다). nw_mask 가 있는 메시는 write_mask 가
#   nw_mask 를 활성·렌더 색으로 둔다.
# - 공유 노드 그룹(NW_GroundMask·NW_Surface)은 다시 만들 때 다른 스크립트의 재질 링크를 깰 수 있다. 아래
#   "공유 노드 그룹 계약"(_shared_group)이 인터페이스를 보존하거나 소켓 이름으로 다시 이어 이를 막는다.
import bpy, bmesh, os, math, io, logging, contextlib, random, json
from mathutils import Vector, Matrix, noise
from mathutils.geometry import delaunay_2d_cdt

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
SRC = os.path.join(ROOT, 'build', 'nowhere-src')
OUT = os.path.join(ROOT, 'build', 'nowhere')
SCENE_NAME = 'NW_World'

# UVMap_mask 가 덮는 세계 XY 사각형(장면 범위 x −110…+160, y −160…+170 에 여유 2 m).
# 274 × 334 m → 마스크 텍스처는 세로 2048 기준 1680 × 2048 이면 텍셀이 정사각(약 0.163 m).
MASK_RECT = (-112.0, -162.0, 162.0, 172.0)


# ───────────────────────────── 색 · 노이즈
def srgb(hexstr, a=1.0):
    """'#RRGGBB' → 선형 RGBA."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], a)


def n2(x, y, freq, seed=0.0, octaves=1):
    """2D 펄린 fBm, 대략 [−1, 1]."""
    s = 0.0; amp = 1.0; tot = 0.0; f = freq
    for o in range(octaves):
        s += amp * noise.noise(Vector((x * f, y * f, seed + 17.31 * o)))
        tot += amp; amp *= 0.5; f *= 2.03
    return s / tot


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def clamp01(x):
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


# ───────────────────────────── 씬 · 컬렉션
def get_scene(make_active=True):
    sc = bpy.data.scenes.get(SCENE_NAME)
    if sc is None:
        sc = bpy.data.scenes.new(SCENE_NAME)
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    win = getattr(bpy.context, 'window', None)
    if make_active and win is not None and win.scene != sc:
        win.scene = sc
    return sc


def coll(name, scene=None, parent=None):
    """컬렉션을 찾거나 만들고 씬(또는 parent) 아래에 걸어 둔다."""
    scene = scene or get_scene(False)
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
    host = parent.children if parent is not None else scene.collection.children
    if c.name not in host:
        host.link(c)
    return c


def clear_coll(c):
    """컬렉션 안 객체와, 그 객체만 쓰던 메시를 지운다(재실행 시 중복 방지)."""
    meshes = set()
    for o in list(c.all_objects):
        if o.type == 'MESH':
            meshes.add(o.data)
        bpy.data.objects.remove(o, do_unlink=True)
    for me in meshes:
        if me.users == 0:
            bpy.data.meshes.remove(me)
    for ch in list(c.children):
        clear_coll(ch)


def tag(o, surface, **extra):
    """§5 규약: 객체 사용자 속성 nw_surface (glTF extras 로 나간다)."""
    o['nw_surface'] = surface
    for k, v in extra.items():
        o[k] = v
    return o


# ───────────────────────────── 이미지 · 텍스처
def img(path, noncolor=False):
    im = bpy.data.images.load(path, check_existing=True)
    if noncolor:
        im.colorspace_settings.is_data = True
    return im


def tex_files(tid, res='2k'):
    d = os.path.join(SRC, 'tex', tid)
    f = {k: os.path.join(d, f'{tid}_{k}_{res}.jpg') for k in ('diff', 'nor_gl', 'arm', 'disp')}
    return {k: v for k, v in f.items() if os.path.exists(v)}


# ───────────────────────────── 셰이더 노드 조립 도우미
def _sock(sockets, name):
    """이름이 같은 소켓이 여럿일 때(Mix 노드 등) 켜져 있는 것을 고른다."""
    cands = [s for s in sockets if s.name == name or s.identifier == name]
    for s in cands:
        if getattr(s, 'enabled', True):
            return s
    return cands[0]


class NB:
    """노드 트리 조립기. 숫자/튜플은 기본값으로, 소켓은 링크로 꽂는다."""

    def __init__(self, nt):
        self.nt = nt; self.N = nt.nodes; self.L = nt.links

    def node(self, typ, **props):
        n = self.N.new(typ)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def put(self, sock, v):
        if v is None:
            return
        if isinstance(v, bpy.types.NodeSocket):
            self.L.new(v, sock)
        else:
            sock.default_value = v

    def set(self, n, **inputs):
        for k, v in inputs.items():
            self.put(_sock(n.inputs, k.replace('__', ' ')), v)
        return n

    # 수학
    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            if v is not None:
                self.put(n.inputs[i], v)
        return n.outputs[0]

    def add(self, a, b, clamp=False): return self.math('ADD', a, b, clamp=clamp)
    def sub(self, a, b, clamp=False): return self.math('SUBTRACT', a, b, clamp=clamp)
    def mul(self, a, b, clamp=False): return self.math('MULTIPLY', a, b, clamp=clamp)
    def mad(self, a, b, c, clamp=False): return self.math('MULTIPLY_ADD', a, b, c, clamp=clamp)
    def mx(self, a, b): return self.math('MAXIMUM', a, b)
    def mn(self, a, b): return self.math('MINIMUM', a, b)

    def smooth(self, e0, e1, x, lo=0.0, hi=1.0):
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', clamp=True)
        self.put(n.inputs['Value'], x); self.put(n.inputs['From Min'], e0); self.put(n.inputs['From Max'], e1)
        self.put(n.inputs['To Min'], lo); self.put(n.inputs['To Max'], hi)
        return n.outputs[0]

    def remap(self, x, e0, e1, lo, hi, clamp=True):
        n = self.node('ShaderNodeMapRange', interpolation_type='LINEAR', clamp=clamp)
        self.put(n.inputs['Value'], x); self.put(n.inputs['From Min'], e0); self.put(n.inputs['From Max'], e1)
        self.put(n.inputs['To Min'], lo); self.put(n.inputs['To Max'], hi)
        return n.outputs[0]

    def mix(self, kind, f, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type=kind)
        if kind == 'RGBA':
            n.blend_type = blend
        self.put(_sock(n.inputs, 'Factor'), f)
        self.put(_sock(n.inputs, 'A'), a); self.put(_sock(n.inputs, 'B'), b)
        return _sock(n.outputs, 'Result')

    def col(self, f, a, b, blend='MIX'): return self.mix('RGBA', f, a, b, blend)
    def flt(self, f, a, b): return self.mix('FLOAT', f, a, b)

    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self.put(n.inputs[0], a)
        if b is not None:
            self.put(n.inputs[1], b)
        if scale is not None:
            self.put(n.inputs['Scale'], scale)
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']

    def noise(self, vec, scale, detail=2.0, rough=0.5, dist=0.0):
        n = self.node('ShaderNodeTexNoise')
        self.put(n.inputs['Vector'], vec); n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
        n.inputs['Distortion'].default_value = dist
        return n.outputs['Fac']

    def sep(self, c):
        n = self.node('ShaderNodeSeparateColor'); self.put(n.inputs[0], c)
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def sepxyz(self, v):
        n = self.node('ShaderNodeSeparateXYZ'); self.put(n.inputs[0], v)
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def rgb(self, r, g, b):
        n = self.node('ShaderNodeCombineColor'); self.put(n.inputs[0], r); self.put(n.inputs[1], g); self.put(n.inputs[2], b)
        return n.outputs[0]

    def group(self, tree, **inputs):
        n = self.node('ShaderNodeGroup'); n.node_tree = tree
        for k, v in inputs.items():
            self.put(n.inputs[k], v)
        return n


# ───────────────────────────── 공유 노드 그룹 계약
# NW_GroundMask · NW_Surface 는 여러 스크립트가 함께 쓰는 "공유" 그룹이다(ground.py 의 지면 재질, Task 3·4 가
# lib.pbr() 로 만드는 벽·바위 재질, Task 5 헤드리스 build.py 가 순서대로 부르는 모든 스크립트).
# 위험: 그룹 인터페이스(소켓)를 지웠다 다시 만들면 소켓 식별자가 바뀌어, 그 그룹을 쓰던 모든 재질의 입력 링크가
#       조용히 끊긴다(Task 2 iteration 0 의 "하얀 지면"). importlib.reload(lib) 나 새 프로세스마다 다시 만들게 되므로
#       "한 실행에 한 번만" 으로는 막을 수 없다.
# 보장(_shared_group):
#   1) 기존 그룹의 인터페이스 서명(입력·출력 각각의 이름·소켓 타입·순서)이 이번 정의와 같으면 인터페이스는 건드리지
#      않고 내부 노드만 다시 만든다 → 그룹 노드의 소켓이 그대로라 어느 재질의 링크도 끊기지 않는다.
#   2) 서명이 다르면(정의를 바꾼 경우) 그 그룹을 쓰는 모든 그룹 노드(재질·월드·다른 노드 그룹)의 링크와 기본값을
#      소켓 이름 기준으로 저장 → 인터페이스 재생성 → 이름으로 다시 잇는다. 새 정의에 없는 이름의 링크만 버리고 출력한다.
#   그룹에는 커스텀 속성 nw_version(내부 정의 버전)과 nw_iface(인터페이스 서명)를 남긴다. 그룹 정의를 바꾸면 버전을 올린다.
#   공유 그룹의 소켓 이름은 재질들이 이름으로 잇는 계약이므로 함부로 바꾸지 않는다(바꾸면 2) 의 경로로 링크를 잃는다).
_BUILT = {}          # 같은 모듈 인스턴스 안에서 내부 노드를 한 번만 다시 만들기 위한 캐시(안전과는 무관, 속도용)


def _sig_items(g):
    items = [it for it in g.interface.items_tree if it.item_type == 'SOCKET']
    return ([(it.name, it.socket_type) for it in items if it.in_out == 'INPUT'],
            [(it.name, it.socket_type) for it in items if it.in_out == 'OUTPUT'])


def _sig_spec(spec):
    return ([(n, t) for n, io_, t, _ in spec if io_ == 'INPUT'], [(n, t) for n, io_, t, _ in spec if io_ == 'OUTPUT'])


def _sig_str(sig):
    return '|'.join(','.join(f'{n}:{t}' for n, t in part) for part in sig)


def _group_users(g):
    """g 를 쓰는 (소유자 이름, 노드 트리, 그룹 노드) 목록."""
    trees = [(m.name, m.node_tree) for m in bpy.data.materials if m.node_tree]
    trees += [(w.name, w.node_tree) for w in bpy.data.worlds if w.node_tree]
    trees += [(ng.name, ng) for ng in bpy.data.node_groups if ng is not g]
    return [(own, nt, n) for own, nt in trees for n in nt.nodes if n.type == 'GROUP' and n.node_tree == g]


def _dv(sock):
    v = getattr(sock, 'default_value', None)
    return tuple(v) if hasattr(v, '__len__') else v


def _save_links(g):
    saved = []
    for own, nt, n in _group_users(g):
        ins = [(s.name, [(l.from_node.name, l.from_socket.identifier) for l in s.links], _dv(s)) for s in n.inputs]
        outs = [(s.name, [(l.to_node.name, l.to_socket.identifier) for l in s.links]) for s in n.outputs]
        saved.append((own, nt, n.name, ins, outs))
    return saved


def _restore_links(g, saved):
    lost = []
    for own, nt, nname, ins, outs in saved:
        n = nt.nodes.get(nname)
        if n is None:
            continue
        n.node_tree = g                                   # 새 인터페이스로 소켓 갱신
        for sname, links, dv in ins:
            s = n.inputs.get(sname)
            if s is None:
                if links:
                    lost.append(f'{own}/{nname}.in.{sname}')
                continue
            for fn, fid in links:
                fs = next((x for x in nt.nodes[fn].outputs if x.identifier == fid), None)
                if fs is not None:
                    nt.links.new(fs, s)
            if not links and dv is not None:
                try:
                    s.default_value = dv
                except (TypeError, ValueError, AttributeError):
                    pass
        for sname, links in outs:
            s = n.outputs.get(sname)
            if s is None:
                if links:
                    lost.append(f'{own}/{nname}.out.{sname}')
                continue
            for tn, tid in links:
                ts = next((x for x in nt.nodes[tn].inputs if x.identifier == tid), None)
                if ts is not None:
                    nt.links.new(s, ts)
    if lost:
        print(f'{g.name}: 새 인터페이스에 없는 소켓이라 다시 잇지 못한 링크 {len(lost)}개:', lost[:20])
    return lost


def _shared_group(name, spec, version):
    """공유 그룹을 계약대로 준비해 내부 노드를 비운 채 돌려준다(호출자가 내부를 다시 채운다)."""
    g = bpy.data.node_groups.get(name)
    created = g is None
    if created:
        g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
    want = _sig_spec(spec)
    if created or _sig_items(g) != want:
        saved = [] if created else _save_links(g)
        g.interface.clear()
        for n, io_, t, _ in spec:
            g.interface.new_socket(n, in_out=io_, socket_type=t)
        if saved:
            _restore_links(g, saved)
            print(f'{name}: 인터페이스가 바뀌어 사용 노드 {len(saved)}개를 소켓 이름으로 다시 이었다')
    # 인터페이스 기본값만 갱신(기존 그룹 노드의 값은 노드마다 따로 있으므로 바뀌지 않는다)
    items = [it for it in g.interface.items_tree if it.item_type == 'SOCKET' and it.in_out == 'INPUT']
    for it, (n, io_, t, dv) in zip(items, [x for x in spec if x[1] == 'INPUT']):
        if dv is not None:
            it.default_value = dv
    g.nodes.clear()
    g['nw_version'] = version
    g['nw_iface'] = _sig_str(want)
    return g


def _once(name, builder):
    g = bpy.data.node_groups.get(name)
    if name in _BUILT and g is not None:
        return g
    g = builder()
    _BUILT[name] = g
    return g


MASK_VERSION = 2       # v1: Task 2 첫 정의, v2: 인터페이스 보존 계약 도입(내용 동일)
SURFACE_VERSION = 2
MASK_IFACE = [
    ('Drive', 'INPUT', 'NodeSocketColor', (0, 0, 0, 1)),     # nw_drive RGB
    ('Fill', 'INPUT', 'NodeSocketFloat', 0.0),                # nw_drive A: 고인 물 깊이(0..1)
    ('Position', 'INPUT', 'NodeSocketVector', None),          # 월드 위치(m)
    ('BaseWet', 'INPUT', 'NodeSocketFloat', 0.3),             # 재질 전체의 축축함
    ('MossBias', 'INPUT', 'NodeSocketFloat', 0.0),
    ('PuddleBias', 'INPUT', 'NodeSocketFloat', 0.0),
    ('Moss', 'OUTPUT', 'NodeSocketFloat', None),
    ('Wet', 'OUTPUT', 'NodeSocketFloat', None),
    ('AO', 'OUTPUT', 'NodeSocketFloat', None),
    ('Puddle', 'OUTPUT', 'NodeSocketFloat', None),
    ('Water', 'OUTPUT', 'NodeSocketFloat', None),
]
SURFACE_IFACE = [
    ('Color', 'INPUT', 'NodeSocketColor', (0.5, 0.5, 0.5, 1)),
    ('Roughness', 'INPUT', 'NodeSocketFloat', 0.8),
    ('Normal', 'INPUT', 'NodeSocketVector', None),
    ('Height', 'INPUT', 'NodeSocketFloat', 0.5),        # 텍스처 disp(0 = 틈, 1 = 윗면)
    ('Moss', 'INPUT', 'NodeSocketFloat', 0.0),
    ('Wet', 'INPUT', 'NodeSocketFloat', 0.0),
    ('AO', 'INPUT', 'NodeSocketFloat', 1.0),
    ('Puddle', 'INPUT', 'NodeSocketFloat', 0.0),
    ('CreviceMoss', 'INPUT', 'NodeSocketFloat', 2.0),   # 이끼가 틈을 얼마나 고집하나
    ('CrevicePuddle', 'INPUT', 'NodeSocketFloat', 0.8), # 물이 틈부터 차오르는 정도
    ('Porosity', 'INPUT', 'NodeSocketFloat', 0.5),      # 젖으면 알베도가 얼마나 어두워지나
    ('WetGloss', 'INPUT', 'NodeSocketFloat', 0.7),      # 젖으면 거칠기가 얼마나 줄어드나(흙은 작게, 아스팔트는 크게)
    ('Position', 'INPUT', 'NodeSocketVector', None),
    ('Color', 'OUTPUT', 'NodeSocketColor', None),
    ('Roughness', 'OUTPUT', 'NodeSocketFloat', None),
    ('Normal', 'OUTPUT', 'NodeSocketVector', None),
    ('MossF', 'OUTPUT', 'NodeSocketFloat', None),
    ('PuddleF', 'OUTPUT', 'NodeSocketFloat', None),
]


# ───────────────────────────── 마스크 노드 그룹
def ensure_mask_group():
    """NW_GroundMask: 지면 마스크 하나의 정의. 출력 Moss·Wet·AO·Puddle(0..1).
    Task 5 가 이 출력을 그대로 RGBA(R 이끼, G 젖음, B AO, A 웅덩이)로 굽는다 — 웹과 같은 의미."""
    g = _shared_group('NW_GroundMask', MASK_IFACE, MASK_VERSION)
    b = NB(g)
    gi = b.node('NodeGroupInput'); go = b.node('NodeGroupOutput')
    # nw_drive: R 물 모임(배수 경사·바퀴 자국·저지대), G 가장자리·그늘(통행 마모는 미리 뺌),
    #           B 비 노출(1 = 하늘 아래, 0 = 처마·캔틸레버 밑), A 고인 물 깊이.
    R, G, B = b.sep(gi.outputs['Drive'])
    P = gi.outputs['Position']
    nL = b.sub(b.noise(P, 0.045, 3.0, 0.5), 0.5)     # ~22 m 파장: 넓은 젖음 얼룩
    nM = b.sub(b.noise(P, 0.42, 4.0, 0.55), 0.5)     # ~2.4 m: 웅덩이 윤곽
    nS = b.sub(b.noise(P, 2.6, 3.0, 0.6), 0.5)       # ~0.4 m: 경계의 잔떨림
    # 물 지수: 구동값 + 노이즈. 문턱을 넘으면 웅덩이. 비를 맞지 않는 곳(B=0)은 물이 없다.
    water = b.add(R, b.mul(nL, 1.1))
    water = b.add(water, b.mul(nM, 0.55))
    water = b.add(water, b.mul(nS, 0.16))
    water = b.add(water, gi.outputs['PuddleBias'])
    water = b.mul(water, B)
    fill = b.smooth(0.0, 0.08, gi.outputs['Fill'])
    puddle = b.mx(b.smooth(0.57, 0.65, water), fill)     # 부드러운 띠: 재질에서 높이맵으로 날을 세운다
    halo = b.smooth(0.22, 0.64, water)                       # 웅덩이 둘레의 짙은 젖음
    wet = b.add(gi.outputs['BaseWet'], b.mul(halo, b.sub(1.0, gi.outputs['BaseWet'])), clamp=True)
    wet = b.mx(b.mul(wet, B), puddle)
    # 이끼: 가장자리·그늘(G) + 물가 띠 + 노이즈. 웅덩이 안·마른 처마 밑에는 없다.
    edge = b.mul(b.smooth(0.42, 0.62, water), b.sub(1.0, puddle, clamp=True))
    mpot = b.add(G, b.mul(edge, 0.55))
    mpot = b.add(mpot, gi.outputs['MossBias'])
    mpot = b.add(mpot, b.mul(nM, 0.7))
    mpot = b.add(mpot, b.mul(nL, 0.6))
    moss = b.mul(b.smooth(0.38, 0.78, mpot), b.sub(1.0, b.mul(fill, 1.0), clamp=True))
    moss = b.mul(moss, B)
    ao = b.sub(1.0, b.mul(G, 0.5), clamp=True)
    b.L.new(moss, go.inputs['Moss']); b.L.new(wet, go.inputs['Wet'])
    b.L.new(ao, go.inputs['AO']); b.L.new(puddle, go.inputs['Puddle']); b.L.new(water, go.inputs['Water'])
    return g


def ensure_surface_group():
    """NW_Surface: 마스크를 재질 반응으로 바꾼다(높이 블렌드 이끼, 젖음 어둡기·광택, 웅덩이 거울면)."""
    g = _shared_group('NW_Surface', SURFACE_IFACE, SURFACE_VERSION)
    b = NB(g)
    gi = b.node('NodeGroupInput'); go = b.node('NodeGroupOutput')
    geo = b.node('ShaderNodeNewGeometry')
    I = gi.outputs
    crev = b.sub(0.5, I['Height'])                       # +: 틈, −: 윗면
    # 이끼: 높이 블렌드 — 같은 마스크라도 틈에서 먼저 자란다.
    mfac = b.mul(I['Moss'], b.add(1.0, b.mul(crev, I['CreviceMoss'])))
    mossF = b.smooth(0.42, 0.56, mfac)
    # 웅덩이: 틈부터 물이 차고 날이 선 경계.
    pfac = b.add(I['Puddle'], b.mul(crev, I['CrevicePuddle']))
    puddleF = b.smooth(0.47, 0.53, pfac)
    wetF = b.mx(I['Wet'], puddleF)
    # 이끼 색: 올리브 #3A461C ~ #5C652D (DS 리서치 §2), 0.5 m 노이즈로 얼룩.
    mv = b.noise(I['Position'], 1.7, 3.0, 0.6)
    mossC = b.col(b.smooth(0.35, 0.65, mv), srgb('#3A461C'), srgb('#5C652D'))
    c = b.col(mossF, I['Color'], mossC)
    # 젖음: 알베도 어둡게(다공성), 웅덩이는 더 어둡게(물빛).
    dark = b.sub(1.0, b.mul(I['Porosity'], wetF))
    c = b.col(1.0, c, b.rgb(dark, dark, dark), 'MULTIPLY')
    c = b.col(b.mul(puddleF, 0.75), c, srgb('#151B1D'))
    ao = b.flt(0.9, 1.0, I['AO'])
    c = b.col(1.0, c, b.rgb(ao, ao, ao), 'MULTIPLY')
    r = b.flt(mossF, I['Roughness'], 0.88)
    r = b.flt(wetF, r, b.mul(r, b.sub(1.0, I['WetGloss'])))
    r = b.flt(puddleF, r, 0.03)
    # 노멀: 이끼는 잔 범프, 웅덩이는 평평한 수면.
    bump = b.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.01
    b.put(bump.inputs['Height'], b.noise(I['Position'], 38.0, 3.0, 0.7)); b.put(bump.inputs['Normal'], I['Normal'])
    nrm = b.mix('VECTOR', mossF, I['Normal'], bump.outputs['Normal'])
    nrm = b.mix('VECTOR', puddleF, nrm, geo.outputs['Normal'])
    nrm = b.vmath('NORMALIZE', nrm)
    for k, v in (('Color', c), ('Roughness', r), ('Normal', nrm), ('MossF', mossF), ('PuddleF', puddleF)):
        b.L.new(v, go.inputs[k])
    return g


# ───────────────────────────── 재질 조립기
class Mat:
    """지면 재질 조립기. 모든 NW 재질은 같은 마스크 그룹을 읽는다(웹과 같은 의미)."""

    def __init__(self, name):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        m.node_tree.nodes.clear()
        self.m = m; self.b = NB(m.node_tree)
        self.out = self.b.node('ShaderNodeOutputMaterial')
        self.bsdf = self.b.node('ShaderNodeBsdfPrincipled')
        self.b.L.new(self.bsdf.outputs[0], self.out.inputs['Surface'])
        self.geo = self.b.node('ShaderNodeNewGeometry')
        self.pos = self.geo.outputs['Position']
        self.meta = {'kind': 'texset', 'tex': []}     # finish() 가 재질 속성 nw_tex 로 남긴다(노드 트리는 바꾸지 않음)

    @staticmethod
    def _coord_info(vec):
        """texset 에 들어온 좌표 소켓에서 타일 크기(m)·회전·좌표 종류를 읽는다(기록용)."""
        n = getattr(vec, 'node', None)
        if n is None or n.type != 'MAPPING':
            return {}
        sc = n.inputs['Scale'].default_value
        src = n.inputs['Vector'].links[0].from_node if n.inputs['Vector'].links else None
        coords = src.uv_map if (src is not None and src.type == 'UVMAP') else ('Object' if src is not None else '?')
        return {'tile_m': round(1.0 / sc[0], 4) if sc[0] else None, 'rot': round(n.inputs['Rotation'].default_value[2], 4),
                'offset': [round(v, 4) for v in n.inputs['Location'].default_value[:2]], 'coords': coords}

    def uv(self, size_m, uv_name='UVMap', rot=0.0, offset=(0, 0)):
        """미터 단위 UV(UVMap) → 타일 크기 size_m."""
        u = self.b.node('ShaderNodeUVMap', uv_map=uv_name)
        mp = self.b.node('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / size_m, 1 / size_m, 1)
        mp.inputs['Rotation'].default_value = (0, 0, rot)
        mp.inputs['Location'].default_value = (offset[0], offset[1], 0)
        self.b.L.new(u.outputs['UV'], mp.inputs['Vector'])
        return mp.outputs['Vector']

    def obj(self, size_m):
        tc = self.b.node('ShaderNodeTexCoord')
        mp = self.b.node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / size_m,) * 3
        self.b.L.new(tc.outputs['Object'], mp.inputs['Vector'])
        return mp.outputs['Vector']

    def tex(self, path, vec, noncolor=False, box=False):
        t = self.b.node('ShaderNodeTexImage'); t.image = img(path, noncolor)
        t.interpolation = 'Linear'
        if box:
            t.projection = 'BOX'; t.projection_blend = 0.25
        self.b.L.new(vec, t.inputs['Vector'])
        return t

    def texset(self, tid, vec, res='2k', box=False, normal=1.0):
        f = tex_files(tid, res)
        self.meta['tex'].append(dict({'tid': tid, 'res': res, 'box': box, 'normal': normal}, **self._coord_info(vec)))
        d = {}
        d['color'] = self.tex(f['diff'], vec, False, box).outputs['Color']
        if 'arm' in f:
            ao, rough, metal = self.b.sep(self.tex(f['arm'], vec, True, box).outputs['Color'])
            d['ao'] = ao; d['rough'] = rough; d['metal'] = metal
        else:
            d['ao'] = 1.0; d['rough'] = 0.8; d['metal'] = 0.0
        d['nor_img'] = self.tex(f['nor_gl'], vec, True, box).outputs['Color']
        nm = self.b.node('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal
        self.b.L.new(d['nor_img'], nm.inputs['Color']); d['normal'] = nm.outputs['Normal']
        d['height'] = self.tex(f['disp'], vec, True, box).outputs['Color'] if 'disp' in f else 0.5
        if not isinstance(d['height'], float):
            d['height'] = self.b.sep(d['height'])[0]
        return d

    def micro(self, normal, tid, size_m, strength=0.6, res='2k', near=6.0, far=28.0, box=False):
        """#7 근경 마이크로 디테일: 같은 노멀을 작은 주기로 한 번 더(거리에 따라 사라짐)."""
        f = tex_files(tid, res)
        self.meta['micro'] = {'tid': tid, 'tile_m': size_m, 'strength': strength, 'fade_m': [near, far]}
        vec = self.obj(size_m) if box else self.uv(size_m, rot=0.7, offset=(0.37, 0.11))
        t = self.tex(f['nor_gl'], vec, True, box)
        cam = self.b.node('ShaderNodeCameraData')
        fade = self.b.remap(cam.outputs['View Distance'], near, far, strength, 0.0)
        nm = self.b.node('ShaderNodeNormalMap')
        self.b.put(nm.inputs['Strength'], fade); self.b.L.new(t.outputs['Color'], nm.inputs['Color'])
        s = self.b.vmath('ADD', normal, nm.outputs['Normal'])
        s = self.b.vmath('SUBTRACT', s, self.geo.outputs['Normal'])
        return self.b.vmath('NORMALIZE', s)

    def macro_var(self, color, amount=0.16, scale=0.05):
        """넓은 면의 타일 반복을 깨는 저주파 명도 변화."""
        n = self.b.noise(self.pos, scale, 3.0, 0.55)
        v = self.b.remap(n, 0.3, 0.7, 1.0 - amount, 1.0 + amount * 0.6)
        return self.b.col(1.0, color, self.b.rgb(v, v, v), 'MULTIPLY')

    def grade(self, color, sat=1.0, tint=None, gain=1.0):
        # 텍스처 세트마다 따로 보정하는 재질(예: 두 번 grade)도 모두 남도록 목록에 쌓는다. tex 는 직전 texset 의 순번.
        self.meta.setdefault('grade', []).append({'tex': len(self.meta['tex']) - 1, 'sat': sat,
                                                  'tint': [round(v, 4) for v in tint[:3]] if tint is not None else None, 'gain': gain})
        c = color
        if sat != 1.0:
            hs = self.b.node('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = sat
            self.b.L.new(c, hs.inputs['Color']); c = hs.outputs['Color']
        if tint is not None:
            c = self.b.col(1.0, c, tint, 'MULTIPLY')
        if gain != 1.0:
            c = self.b.col(1.0, c, (gain, gain, gain, 1), 'MULTIPLY')
        return c

    def mask(self, base_wet=0.3, moss_bias=0.0, puddle_bias=0.0):
        """NW_GroundMask(nw_drive) 와 정점색 nw_mask 를 객체 속성 nw_vmask 로 고른다."""
        b = self.b
        drive = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_drive')
        vm = b.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='nw_mask')
        use = b.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='nw_vmask').outputs['Fac']
        gm = b.group(_once('NW_GroundMask', ensure_mask_group), Drive=drive.outputs['Color'], Fill=drive.outputs['Alpha'],
                     Position=self.pos, BaseWet=base_wet, MossBias=moss_bias, PuddleBias=puddle_bias)
        vr, vg, vb = b.sep(vm.outputs['Color'])
        return {
            'moss': b.flt(use, gm.outputs['Moss'], vr),
            'wet': b.flt(use, gm.outputs['Wet'], vg),
            'ao': b.flt(use, gm.outputs['AO'], vb),
            'puddle': b.flt(use, gm.outputs['Puddle'], 0.0),
            'water': gm.outputs['Water'],
        }

    def surface(self, color, rough, normal, height, mk, crevice_moss=2.0, crevice_puddle=0.8, porosity=0.5, wet_gloss=0.7):
        return self.b.group(_once('NW_Surface', ensure_surface_group), Color=color, Roughness=rough, Normal=normal, Height=height,
                            Moss=mk['moss'], Wet=mk['wet'], AO=mk['ao'], Puddle=mk['puddle'],
                            CreviceMoss=crevice_moss, CrevicePuddle=crevice_puddle, Porosity=porosity,
                            WetGloss=wet_gloss, Position=self.pos)

    def finish(self, color, rough, normal, metallic=0.0, spec=0.5):
        self.meta['metallic'] = metallic if isinstance(metallic, (int, float)) else 'linked'
        self.m['nw_tex'] = json.dumps(self.meta, ensure_ascii=False)
        self.b.put(self.bsdf.inputs['Base Color'], color)
        self.b.put(self.bsdf.inputs['Roughness'], rough)
        self.b.put(self.bsdf.inputs['Normal'], normal)
        self.b.put(self.bsdf.inputs['Metallic'], metallic)
        self.b.put(self.bsdf.inputs['Specular IOR Level'], spec)
        return self.m


def pbr(name, tid, size_m=2.0, res='2k', base_wet=0.3, moss_bias=0.0, puddle_bias=-1.0, tint=None, sat=1.0,
        box=False, normal=1.0, micro=0.0, crevice_moss=2.0, porosity=0.5):
    """룩뎁 pbr() 의 후속: tid 텍스처 PBR + NW 마스크 반응. 벽·바위 등 Task 3·4 공용."""
    M = Mat(name)
    vec = M.obj(size_m) if box else M.uv(size_m)
    t = M.texset(tid, vec, res, box, normal)
    nrm = M.micro(t['normal'], tid, size_m / 8.0, micro, res, box=box) if micro > 0 else t['normal']
    c = M.grade(t['color'], sat, tint)
    c = M.macro_var(c)
    mk = M.mask(base_wet, moss_bias, puddle_bias)
    s = M.surface(c, t['rough'], nrm, t['height'], mk, crevice_moss, 0.8, porosity)
    return M.finish(s.outputs['Color'], s.outputs['Roughness'], s.outputs['Normal'])


# ───────────────────────────── 2D 도형 · CDT 메시
class RRect:
    """모서리마다 반지름이 다른 둥근 사각형. r = (SW, SE, NE, NW)."""

    def __init__(self, x0, y0, x1, y1, r=(0, 0, 0, 0)):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.r = tuple(max(0.0, v) for v in r)

    def inset(self, d, r=None):
        rr = r if r is not None else tuple(max(0.0, v - d) for v in self.r)
        return RRect(self.x0 + d, self.y0 + d, self.x1 - d, self.y1 - d, rr)

    def inset_sides(self, wb, wr, wt, wl):
        """변마다 다른 폭으로 안쪽 사각형(아래, 오른쪽, 위, 왼쪽). 모서리 반지름 = r − min(이웃 폭) — 바깥 호 안에 머문다."""
        def ri(rc, a, b):
            return max(0.0, rc - min(a, b)) if rc > 0 else 0.0
        r = (ri(self.r[0], wb, wl), ri(self.r[1], wb, wr), ri(self.r[2], wt, wr), ri(self.r[3], wt, wl))
        return RRect(self.x0 + wl, self.y0 + wb, self.x1 - wr, self.y1 - wt, r)

    def sdf(self, x, y):
        cx = (self.x0 + self.x1) * 0.5; cy = (self.y0 + self.y1) * 0.5
        hx = (self.x1 - self.x0) * 0.5; hy = (self.y1 - self.y0) * 0.5
        px = x - cx; py = y - cy
        r = self.r[2] if (px >= 0 and py >= 0) else self.r[1] if (px >= 0) else self.r[3] if (py >= 0) else self.r[0]
        qx = abs(px) - hx + r; qy = abs(py) - hy + r
        ox = max(qx, 0.0); oy = max(qy, 0.0)
        return math.hypot(ox, oy) + min(max(qx, qy), 0.0) - r

    def outline(self, step=2.0, arc_step=0.35):
        """반시계 방향 닫힌 폴리라인 [(x, y), ...] (마지막 점 ≠ 첫 점)."""
        x0, y0, x1, y1 = self.x0, self.y0, self.x1, self.y1
        rSW, rSE, rNE, rNW = self.r
        pts = []

        def line(a, b):
            L = math.dist(a, b); n = max(1, int(math.ceil(L / step)))
            for i in range(n):
                t = i / n; pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))

        def arc(c, r, a0, a1):
            if r <= 1e-6:
                pts.append((c[0], c[1])); return
            n = max(2, int(math.ceil(r * abs(a1 - a0) / arc_step)))
            for i in range(n):
                a = a0 + (a1 - a0) * i / n; pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))

        h = math.pi / 2
        line((x0 + rSW, y0), (x1 - rSE, y0)); arc((x1 - rSE, y0 + rSE), rSE, -h, 0)
        line((x1, y0 + rSE), (x1, y1 - rNE)); arc((x1 - rNE, y1 - rNE), rNE, 0, h)
        line((x1 - rNE, y1), (x0 + rNW, y1)); arc((x0 + rNW, y1 - rNW), rNW, h, 2 * h)
        line((x0, y1 - rNW), (x0, y0 + rSW)); arc((x0 + rSW, y0 + rSW), rSW, 2 * h, 3 * h)
        # 같은 점 제거
        out = []
        for p in pts:
            if not out or math.dist(out[-1], p) > 1e-4:
                out.append(p)
        if math.dist(out[0], out[-1]) < 1e-4:
            out.pop()
        return out


def poly_circle(cx, cy, r, n=24):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def point_in_poly(x, y, poly):
    """짝홀 규칙 다각형 안 판정."""
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def cdt(loops, points, inside, eps=1e-4, min_gap=0.0, dist_fn=None, lines=()):
    """제약 CDT. loops: 닫힌 폴리라인 목록(경계·구멍), lines: 열린 제약선(필지 경계 등), points: 내부 표본점,
    inside(x, y): 삼각형 무게중심이 영역 안인지. min_gap 보다 경계에 가까운 내부 점은 버린다(가는 삼각형 방지).
    반환: (verts2d, tris)."""
    V = []; E = []
    for lp in loops:
        base = len(V)
        V.extend(Vector((p[0], p[1])) for p in lp)
        n = len(lp)
        E.extend((base + i, base + (i + 1) % n) for i in range(n))
    for ln in lines:
        base = len(V)
        V.extend(Vector((p[0], p[1])) for p in ln)
        E.extend((base + i, base + i + 1) for i in range(len(ln) - 1))
    for p in points:
        if dist_fn is not None and min_gap > 0 and dist_fn(p[0], p[1]) < min_gap:
            continue
        V.append(Vector((p[0], p[1])))
    res = delaunay_2d_cdt(V, E, [], 0, eps, False)
    vo, fo = res[0], res[2]
    tris = []
    for f in fo:
        cx = sum(vo[i].x for i in f) / len(f); cy = sum(vo[i].y for i in f) / len(f)
        if inside(cx, cy):
            tris.append(tuple(f))
    used = sorted({i for f in tris for i in f})
    remap = {o: n for n, o in enumerate(used)}
    return [(vo[i].x, vo[i].y) for i in used], [tuple(remap[i] for i in f) for f in tris]


class Sampler:
    """삼각형 메시 위 높이 조회(2D 격자 해시). 노면 표시·맨홀을 실제 노면 삼각형 위에 얹을 때 쓴다."""

    def __init__(self, verts, tris, cell=2.0):
        self.v = verts; self.t = tris; self.cell = cell; self.h = {}
        for ti, f in enumerate(tris):
            xs = [verts[i][0] for i in f]; ys = [verts[i][1] for i in f]
            for gx in range(int(math.floor(min(xs) / cell)), int(math.floor(max(xs) / cell)) + 1):
                for gy in range(int(math.floor(min(ys) / cell)), int(math.floor(max(ys) / cell)) + 1):
                    self.h.setdefault((gx, gy), []).append(ti)

    def z(self, x, y, default=None):
        key = (int(math.floor(x / self.cell)), int(math.floor(y / self.cell)))
        for ti in self.h.get(key, ()):
            a, b, c = (self.v[i] for i in self.t[ti][:3])
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-12:
                continue
            l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d
            l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d
            l3 = 1 - l1 - l2
            if l1 >= -1e-6 and l2 >= -1e-6 and l3 >= -1e-6:
                return l1 * a[2] + l2 * b[2] + l3 * c[2]
        return default


def grid_points(x0, y0, x1, y1, step, jitter=0.0, seed=1, xs=None, ys=None):
    rnd = random.Random(seed)
    xs = xs or [x0 + i * step for i in range(int((x1 - x0) / step) + 1)]
    ys = ys or [y0 + j * step for j in range(int((y1 - y0) / step) + 1)]
    pts = []
    for y in ys:
        for x in xs:
            if jitter:
                pts.append((x + rnd.uniform(-jitter, jitter) * step, y + rnd.uniform(-jitter, jitter) * step))
            else:
                pts.append((x, y))
    return pts


def offset_ring(loop, d):
    """폴리라인을 법선 방향(반시계 기준 안쪽 = 왼쪽)으로 d 만큼 민 점들(표본점 용, 자기교차 검사 안 함)."""
    n = len(loop); out = []
    for i in range(n):
        a = Vector(loop[i - 1]); p = Vector(loop[i]); c = Vector(loop[(i + 1) % n])
        t = (c - a)
        if t.length < 1e-9:
            continue
        t.normalize(); nn = Vector((-t.y, t.x))
        q = p + nn * d; out.append((q.x, q.y))
    return out


# ───────────────────────────── 메시 · 객체
def mesh_obj(name, verts, faces, c, mats, smooth=True, uvs=None, mask_uv=True, sharp_angle=None):
    """verts: [(x, y, z)], faces: [(i, j, k...)], uvs: {'UVMap': fn(co)->(u, v)} 정점 기준 UV 함수.
    mask_uv=True 면 UVMap_mask(세계 XY 투영)를 만든다."""
    o = bpy.data.objects.get(name)
    if o is not None:
        old = o.data if o.type == 'MESH' else None
        bpy.data.objects.remove(o, do_unlink=True)
        if old is not None and old.users == 0:
            bpy.data.meshes.remove(old)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(clean_customdata=False)
    orient_up(me)
    uvs = dict(uvs or {})
    if 'UVMap' not in uvs:
        uvs['UVMap'] = lambda co: (co[0], co[1])
    if mask_uv:
        uvs['UVMap_mask'] = mask_uv_fn
    for uvname in ['UVMap'] + [k for k in uvs if k != 'UVMap']:
        set_uv(me, uvname, uvs[uvname])
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        me.materials.append(m)
    if smooth:
        me.shade_smooth()
    if sharp_angle is not None:
        me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def orient_up(me):
    """윗면이 아래를 보면 전체 면 방향을 뒤집는다(스윕·고리 메시의 감김 방향 정리)."""
    s = sum(p.normal.z * p.area for p in me.polygons)
    tot = sum(p.area for p in me.polygons)
    if s < -1e-3 * tot:          # 닫힌 메시(합 ≈ 0)는 건드리지 않는다
        me.flip_normals()
    return me


def recalc_normals(me):
    """닫힌 메시의 면 방향을 바깥으로 맞춘다."""
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return me


def mask_uv_fn(co):
    x0, y0, x1, y1 = MASK_RECT
    return ((co[0] - x0) / (x1 - x0), (co[1] - y0) / (y1 - y0))


def set_uv(me, name, fn, per_loop=None):
    """정점 좌표 함수 fn(co) 또는 루프별 값 per_loop(list of (u, v))로 UV 를 채운다.
    per_loop 길이가 메시 루프 수와 다르면(예: validate() 가 면을 지운 경우) 조용히 대체하지 않고 ValueError 를 낸다."""
    if per_loop is not None and len(per_loop) != len(me.loops):
        raise ValueError(f'set_uv: {me.name}.{name} 루프 수 불일치 {len(per_loop)} != {len(me.loops)}')
    uv = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    if per_loop is not None:
        flat = [c for p in per_loop for c in p]
    else:
        vco = [v.co for v in me.vertices]
        cache = {}
        flat = []
        for lp in me.loops:
            vi = lp.vertex_index
            if vi not in cache:
                cache[vi] = fn(vco[vi])
            flat.extend(cache[vi])
    uv.data.foreach_set('uv', flat)
    return uv


def write_mask(target, fn, name='nw_mask'):
    """정점마다 fn(co, normal) → (이끼, 젖음, AO) 를 계산해 정점색 nw_mask(R, G, B)에 쓴다(§5 COLOR_0).
    target 이 객체면 월드 좌표로 계산하고 nw_vmask=1 을 표시한다. 메시(인스턴스 원형)면 로컬 좌표로 계산한다 —
    링크 복제는 메시를 공유하므로 모든 복제가 같은 마스크를 쓴다(인스턴스 객체에 nw_vmask=1 을 따로 단다)."""
    if isinstance(target, bpy.types.Object):
        me = target.data; mw = target.matrix_world
    else:
        me = target; mw = Matrix.Identity(4)
    a = me.color_attributes.get(name)
    if a is None:
        a = me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    nm = mw.to_3x3()
    vals = []
    for v in me.vertices:
        r, g, b = fn(mw @ v.co, (nm @ v.normal).normalized())
        vals.extend((clamp01(r), clamp01(g), clamp01(b), 1.0))
    a.data.foreach_set('color', vals)
    _make_render_color(me, name)
    if isinstance(target, bpy.types.Object):
        target['nw_vmask'] = 1.0
    return a


def write_mask_values(me, values, name='nw_mask'):
    """write_mask 의 값 목록판: 정점마다 (R 이끼, G 젖음, B AO) 를 이미 계산해 둔 경우. 4번째 값이 있어도 무시하고
    A 는 항상 1 로 쓴다(COLOR_0 은 RGB 의미만 — 머리말). nw_mask 를 활성·렌더 색으로 둔다. 객체 속성 nw_vmask 는 호출자가 단다."""
    if len(values) != len(me.vertices):
        raise ValueError(f'write_mask_values: {me.name} 정점 수 불일치 {len(values)} != {len(me.vertices)}')
    a = me.color_attributes.get(name)
    if a is None:
        a = me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    flat = []
    for v in values:
        flat.extend((clamp01(v[0]), clamp01(v[1]), clamp01(v[2]), 1.0))
    a.data.foreach_set('color', flat)
    _make_render_color(me, name)
    return a


def write_float_attr(me, name, values, dtype='FLOAT'):
    """정점(POINT) 속성을 쓴다: dtype 'FLOAT'(nw_streak) 는 값 목록, 'FLOAT2'(nw_tint) 는 (a, b) 목록.
    길이가 정점 수와 다르면 ValueError."""
    if len(values) != len(me.vertices):
        raise ValueError(f'write_float_attr: {me.name}.{name} 정점 수 불일치 {len(values)} != {len(me.vertices)}')
    a = me.attributes.get(name)
    if a is not None and (a.domain != 'POINT' or a.data_type != dtype):
        me.attributes.remove(a); a = None
    if a is None:
        a = me.attributes.new(name, dtype, 'POINT')
    if dtype == 'FLOAT2':
        a.data.foreach_set('vector', [float(c) for v in values for c in v[:2]])
    else:
        a.data.foreach_set('value', [float(v) for v in values])
    return a


def _make_render_color(me, name):
    """name 정점색을 활성·렌더 색으로(glTF 'ACTIVE' 내보내기에서 COLOR_0 이 되는 쪽)."""
    ca = me.color_attributes
    a = ca.get(name)
    if a is None:
        return
    ca.active_color = a
    ca.render_color_index = [x.name for x in ca].index(name)


def box_uv(me, scale=1.0):
    """면마다 주된 축으로 투영한 미터 단위 UV(인스턴스·잔해용 UVMap)."""
    per = []
    for p in me.polygons:
        n = p.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 2:
                per.append((co.x * scale, co.y * scale))
            elif ax == 1:
                per.append((co.x * scale, co.z * scale))
            else:
                per.append((co.y * scale, co.z * scale))
    set_uv(me, 'UVMap', None, per_loop=per)


def write_drive(me, values, name='nw_drive'):
    """마스크 구동값 nw_drive(R 물 모임, G 가장자리·그늘, B 비 노출(1 = 하늘 아래, 0 = 처마·캔틸레버 밑),
    A 고인 물 깊이) — 정점별 4-튜플 목록. NW_GroundMask 의 입력이자 Task 5 마스크 굽기의 입력일 뿐이다.
    경고: nw_drive 는 FLOAT_COLOR 라 glTF 내보내기에서 COLOR_0 으로 나갈 수 있다. 그러면 §5 의 COLOR_0 = nw_mask
    (R 이끼, G 젖음, B AO) 의미와 충돌하므로 내보내면 안 된다(Task 5: 내보내기 전에 지우거나 정점색을 내보내지
    않는다). 같은 메시에 nw_mask 가 있으면 nw_mask 를 활성·렌더 색으로 유지한다."""
    a = me.color_attributes.get(name)
    if a is None:
        a = me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    flat = []
    for r, g, b, al in values:
        flat.extend((clamp01(r), clamp01(g), clamp01(b), clamp01(al)))
    a.data.foreach_set('color', flat)
    if me.color_attributes.get('nw_mask') is not None:
        _make_render_color(me, 'nw_mask')
    return a


def sweep(path, profile, closed=False):
    """path: [(x, y, z)] (z = 단면 기준 높이), profile: [(a, h)] — a 는 진행 방향 왼쪽(+) 수평 거리, h 는 높이.
    반환: verts, faces, loop_uvs(u = 누적 길이 m, v = 단면 누적 길이 m)."""
    n = len(path); m = len(profile)
    verts = []; s_acc = [0.0]
    for i in range(1, n):
        s_acc.append(s_acc[-1] + math.dist(path[i - 1][:2], path[i][:2]))
    pl = [0.0]
    for j in range(1, m):
        pl.append(pl[-1] + math.dist(profile[j - 1], profile[j]))
    for i in range(n):
        a = Vector(path[i - 1][:2]) if (i > 0 or closed) else Vector(path[i][:2])
        c = Vector(path[(i + 1) % n][:2]) if (i < n - 1 or closed) else Vector(path[i][:2])
        t = (c - a)
        t = t.normalized() if t.length > 1e-9 else Vector((1, 0))
        left = Vector((-t.y, t.x))
        # 꺾이는 점에서 단면 폭 유지(마이터)
        if 0 < i < n - 1 or closed:
            t0 = (Vector(path[i][:2]) - a); t1 = (c - Vector(path[i][:2]))
            if t0.length > 1e-9 and t1.length > 1e-9:
                l0 = Vector((-t0.normalized().y, t0.normalized().x)); l1 = Vector((-t1.normalized().y, t1.normalized().x))
                mid = (l0 + l1); mid = mid.normalized() if mid.length > 1e-6 else left
                k = 1.0 / max(0.3, mid.dot(l0)); left = mid * k
        p = path[i]
        for (pa, ph) in profile:
            verts.append((p[0] + left.x * pa, p[1] + left.y * pa, p[2] + ph))
    faces = []; uvs = []
    segs = n if closed else n - 1
    for i in range(segs):
        i2 = (i + 1) % n
        u0 = s_acc[i]; u1 = s_acc[i] + math.dist(path[i][:2], path[i2][:2])
        for j in range(m - 1):
            a = i * m + j; b = i2 * m + j; c = i2 * m + j + 1; d = i * m + j + 1
            faces.append((a, b, c, d))
            uvs.append([(u0, pl[j]), (u1, pl[j]), (u1, pl[j + 1]), (u0, pl[j + 1])])
    return verts, faces, uvs


def box(name, dims, loc, mat, c, surface=None):
    """룩뎁 box() 이식: dims=(x, y, z) m, loc=바닥 중심(x, y, z_bottom). UVMap 은 면별 미터 투영."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= dims[0]; v.co.y *= dims[1]; v.co.z = (v.co.z + 0.5) * dims[2]
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, me); c.objects.link(o)
    o.location = loc
    box_uv(me, 1.0)
    if mat is not None:
        me.materials.append(mat)
    if surface:
        tag(o, surface)
    return o


def tri_count(objs):
    t = 0
    for o in objs:
        if o.type != 'MESH':
            continue
        for p in o.data.polygons:
            t += len(p.vertices) - 2
    return t


# ───────────────────────────── glTF 가져오기(조용히)
def import_gltf(path, c, scene=None):
    """glTF/GLB 를 데이터로 가져와 컬렉션 c 로 옮긴다. INFO 로그를 막아 MCP 출력이 덮이지 않게 한다."""
    scene = scene or get_scene(False)
    vl = scene.view_layers[0]
    before = set(bpy.data.objects)
    logging.disable(logging.INFO)
    try:
        kw = {}
        win = getattr(bpy.context, 'window', None)
        if win is not None:
            kw['window'] = win
        with bpy.context.temp_override(scene=scene, view_layer=vl, **kw):
            with contextlib.redirect_stdout(io.StringIO()):
                bpy.ops.import_scene.gltf(filepath=path)
    finally:
        logging.disable(logging.NOTSET)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for uc in list(o.users_collection):
            uc.objects.unlink(o)
        c.objects.link(o)
    return new


# ───────────────────────────── 환경: 렌더 · 월드 · 안개
EXPOSURE_OVERCAST = -0.35
VOLUMETRIC_END = 7000.0      # 원경 링(Task 4)의 마지막 능선 6 km + 여유. 카메라 clip_end 도 이보다 길어야 한다(set_far_clip)
FAR_CLIP = 8000.0
FOG_HALF = 6500.0            # 안개 상자 반폭(m). Task 3 까지는 1200 — 원경 링을 덮도록 넓혔다
FOG_NEAR_COL = '#D2D9D7'     # 근경 안개(DS 흐린 낮)
FOG_FAR_COL = '#9AA8B8'      # 원경 연무: 약간 푸른 쪽(원경 #8E9EAF → #CDD0D3, §2.3) — 겹마다 밝고 푸르고 평평하게
FOG_FAR_HAZE = 0.00022       # 원경 연무 밀도(1/m). 높이 감쇠(exp(-z/110))와 함께 1~6 km 능선 겹 대비를 만든다
FOG_FAR_R = (450.0, 1600.0)  # 이 반경(원점 기준 수평 거리) 사이에서 근경 → 원경 연무로 바뀐다. 450 m 안은 Task 3 과 같다


def setup_render(scene, res=(1280, 720), samples=32):
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError as e:
        print('engine:', e)
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    e = scene.eevee
    e.taa_render_samples = samples
    e.taa_samples = 16
    e.use_raytracing = True
    e.ray_tracing_method = 'SCREEN'
    try:
        o = e.ray_tracing_options
        o.resolution_scale = '1'
        o.trace_max_roughness = 0.45
        o.screen_trace_quality = 0.5
    except Exception as ex:
        print('raytrace opts:', ex)
    e.use_shadows = True
    # 형태감(아트 수정 B1): 수평 스캔(fast GI)으로 접지부·모서리 AO. 거리 1.5 m 안의 면만 가린다(넓은 가림은 볼륨 프로브).
    for k, v in (('fast_gi_distance', 1.5), ('fast_gi_quality', 0.5), ('fast_gi_step_count', 10), ('fast_gi_ray_count', 2),
                 ('fast_gi_thickness_near', 0.25), ('shadow_ray_count', 2), ('shadow_step_count', 8)):
        if hasattr(e, k):
            setattr(e, k, v)
    e.volumetric_start = 0.5
    e.volumetric_end = VOLUMETRIC_END      # Task 4: 원경 능선(≤ 6 km)까지 안개가 덮도록 1600 → 7000
    e.volumetric_tile_size = '4'
    e.volumetric_samples = 64
    e.volumetric_sample_distribution = 0.85
    e.use_volumetric_shadows = False
    e.clamp_surface_indirect = 10.0
    try:
        e.use_fast_gi = True
        e.fast_gi_method = 'GLOBAL_ILLUMINATION'
    except Exception:
        pass
    vs = scene.view_settings
    try:
        vs.view_transform = 'AgX'
        vs.look = 'AgX - Medium Low Contrast'
    except TypeError as ex:
        print('color mgmt:', ex)
    vs.exposure = EXPOSURE_OVERCAST; vs.gamma = 1.0   # 근경 지면을 어둡게(DS #3), 하늘은 cam_sky 로 밝게 유지
    scene.render.image_settings.file_format = 'PNG'


def setup_world(scene, hdri='urban_street_03_2k.hdr', strength=0.9, sky_mix=0.6, sky_strength=1.05, cam_sky=1.3):
    """HDRI 는 조명에만, 카메라에는 흐린 하늘 그라데이션(#E7E9E4 지평선 → #C5CFCF 천정).
    월드 볼륨은 쓰지 않는다(EEVEE 에서 하늘빛을 통째로 흡수해 검게 나온다 — 룩뎁에서 확인)."""
    w = bpy.data.worlds.get('NW_World') or bpy.data.worlds.new('NW_World')
    w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear(); b = NB(nt)
    out = b.node('ShaderNodeOutputWorld')
    tc = b.node('ShaderNodeTexCoord')
    env = b.node('ShaderNodeTexEnvironment'); env.image = img(os.path.join(SRC, 'hdri', hdri))
    mp = b.node('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(0))
    b.L.new(tc.outputs['Generated'], mp.inputs['Vector']); b.L.new(mp.outputs['Vector'], env.inputs['Vector'])
    bg = b.node('ShaderNodeBackground'); b.L.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    # 하늘 그라데이션: 시선 방향 z
    _, _, z = b.sepxyz(tc.outputs['Generated'])
    ramp = b.node('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position = 0.0; el[0].color = srgb('#E7E9E4')
    el[1].position = 0.55; el[1].color = srgb('#C5CFCF')
    zz = b.math('MAXIMUM', z, 0.0)
    b.L.new(b.math('POWER', zz, 0.7), ramp.inputs['Fac'])
    sky = b.node('ShaderNodeBackground'); b.L.new(ramp.outputs['Color'], sky.inputs['Color'])
    sky.inputs['Strength'].default_value = cam_sky
    # 조명·반사용 월드 = HDRI 와 흐린 하늘을 섞는다. HDRI 만 쓰면 젖은 노면이 지평선의 집·나무(어두움)를
    # 비춰 검게 나온다 — DS 의 젖은 땅은 흰 하늘을 비춘다(시그니처 #4). 아래 반구는 어두운 지면색.
    below = b.smooth(0.0, -0.12, z)
    lsky = b.col(below, ramp.outputs['Color'], srgb('#3E423F'))
    lbg = b.node('ShaderNodeBackground'); b.L.new(lsky, lbg.inputs['Color'])
    lbg.inputs['Strength'].default_value = sky_strength
    lmix = b.node('ShaderNodeMixShader'); lmix.inputs['Fac'].default_value = sky_mix
    b.L.new(bg.outputs[0], lmix.inputs[1]); b.L.new(lbg.outputs[0], lmix.inputs[2])
    lp = b.node('ShaderNodeLightPath')
    mix = b.node('ShaderNodeMixShader')
    b.L.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    b.L.new(lmix.outputs[0], mix.inputs[1]); b.L.new(sky.outputs[0], mix.inputs[2])
    b.L.new(mix.outputs[0], out.inputs['Surface'])
    try:
        w.sun_threshold = 50.0      # 흐린 날: HDRI 에서 해를 뽑아 그림자를 만들지 않는다
    except Exception:
        pass
    scene.world = w
    setup_key_light(scene)
    return w


KEY_LIGHT = dict(azimuth=215.0, elevation=34.0, angle=10.0, energy=1.3)   # 1.3: 같은 벽돌 동의 남면/동면 휘도비 ≈ 1.19(측정)   # 장면 방위(+Y=0°, 시계 방향), 도, W/m²


def setup_key_light(scene, azimuth=None, elevation=None, angle=None, energy=None):
    """FX_sun: 흐린 날의 약한 키 라이트(구름 너머 해). 남서쪽 낮은 고도에서 부드러운 그림자 — 면마다 밝기가 달라
    상자가 아니라 덩어리로 읽히게 한다(DS #1 의 그림자 없는 확산광을 깨지 않는 선). 컬렉션 NW_fx(내보내지 않음)."""
    az = math.radians(KEY_LIGHT['azimuth'] if azimuth is None else azimuth)
    el = math.radians(KEY_LIGHT['elevation'] if elevation is None else elevation)
    c = coll('NW_fx', scene)
    ld = bpy.data.lights.get('FX_sun')
    if ld is None or ld.type != 'SUN':
        if ld is not None:
            for o in [o for o in bpy.data.objects if o.data == ld]:
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.lights.remove(ld)
        ld = bpy.data.lights.new('FX_sun', 'SUN')
    ld.energy = KEY_LIGHT['energy'] if energy is None else energy
    ld.angle = math.radians(KEY_LIGHT['angle'] if angle is None else angle)
    ld.color = srgb('#FFF4E6')[:3]
    for k, v in (('use_shadow', True), ('shadow_maximum_resolution', 0.05), ('shadow_filter_radius', 3.0), ('use_shadow_jitter', False)):
        if hasattr(ld, k):
            setattr(ld, k, v)
    o = bpy.data.objects.get('FX_sun')
    if o is None:
        o = bpy.data.objects.new('FX_sun', ld)
    if o.name not in c.objects:
        c.objects.link(o)
    to_sun = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    o.rotation_euler = to_sun.to_track_quat('Z', 'Y').to_euler()     # 해는 로컬 −Z 로 비춘다
    o.location = to_sun * 200.0
    setup_light_probes(scene)
    return o


# 볼륨 라이트 프로브(EEVEE): 하늘빛의 큰 가림(고가 상판 밑, 건물 사이 골목, 벽 밑동)을 굽는다. 화면 공간 AO 만으로는
# 화면 밖에 있는 상판이 바닥을 가리지 못한다. 기하가 바뀌면 bake_light_probes() 로 다시 굽는다(present.py 가 끝에서 부름).
# 장면 전체 볼륨(5 m 간격)도 시험했지만 건물 안에 들어간 프로브가 벽면을 얼룩지게 어둡게 해서(빛 새는 반대) 고가 일대만 둔다.
# 벽 밑동·모서리의 가림은 수평 스캔 AO(fast_gi_distance)와 정점 AO 가 맡는다.
PROBES = {   # 이름: (중심, 반 크기 = 객체 배율, 해상도)
    'FX_probe_viaduct': ((25.0, 153.0, 6.5), (137.0, 19.0, 7.5), (64, 10, 5)),
}


def setup_light_probes(scene):
    c = coll('NW_fx', scene)
    for o in [o for o in c.objects if o.name.startswith('FX_probe_') and o.name not in PROBES]:
        lp = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if lp is not None and lp.users == 0:
            bpy.data.lightprobes.remove(lp)
    out = []
    for nm, (loc, half, res) in PROBES.items():
        lp = bpy.data.lightprobes.get(nm)
        if lp is None or lp.type != 'VOLUME':
            lp = bpy.data.lightprobes.new(nm, 'VOLUME')
        o = bpy.data.objects.get(nm)
        if o is None:
            o = bpy.data.objects.new(nm, lp)
        if o.name not in c.objects:
            c.objects.link(o)
        o.location = loc; o.scale = half
        lp.resolution_x, lp.resolution_y, lp.resolution_z = res
        out.append(o)
    return out


def bake_light_probes(scene):
    """볼륨 프로브를 하나씩 굽는다(동기 실행). 창이 없으면(헤드리스) 창 없이 문맥만 넘긴다."""
    win = getattr(bpy.context, 'window', None)
    done = []
    for o in setup_light_probes(scene):
        kw = dict(scene=scene, view_layer=scene.view_layers[0], active_object=o, object=o, selected_objects=[o])
        if win is not None:
            kw['window'] = win
        try:
            with bpy.context.temp_override(**kw):
                r = bpy.ops.object.lightprobe_cache_bake(subset='ACTIVE')
            done.append((o.name, tuple(r)))
        except Exception as ex:
            done.append((o.name, f'실패: {ex}'))
    return done


def setup_fog(scene, c, base=0.0032, haze=0.0005, k=1.0 / 18.0, far_haze=FOG_FAR_HAZE, far_r=FOG_FAR_R, half=FOG_HALF):
    """FX_fog: 높이 지수 안개 상자. 밀도 = (base·exp(−z/18 m) + haze(r))·mult (DS 시그니처 #2 의 Blender 쪽).
    Task 4: 상자를 ±half(6.5 km)로 넓히고, 원점에서 수평 거리 r 이 far_r 사이를 지나면 연무 haze 를 far_haze 로,
    산란색을 근경 FOG_NEAR_COL → 원경 FOG_FAR_COL 로 바꾼다. r < far_r[0](450 m)에서는 Task 3 까지와 같은 식이다.
    이름 붙은 노드(nw_fog_mult · nw_fog_near · nw_fog_far)는 apply_mood() 가 무드마다 값만 바꾼다."""
    name = 'FX_fog'
    o = bpy.data.objects.get(name)
    if o is not None:
        me_old = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me_old.users == 0:
            bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 2 * half; v.co.y *= 2 * half; v.co.z = (v.co.z + 0.5) * 540 - 20
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); c.objects.link(o)
    m = bpy.data.materials.get('NW_fog') or bpy.data.materials.new('NW_fog')
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); b = NB(nt)
    out = b.node('ShaderNodeOutputMaterial')
    vol = b.node('ShaderNodeVolumePrincipled'); vol.name = 'nw_fog_vol'
    vol.inputs['Anisotropy'].default_value = 0.3
    vol.inputs['Absorption Color'].default_value = (0, 0, 0, 1)
    tc = b.node('ShaderNodeTexCoord')
    x, y, z = b.sepxyz(tc.outputs['Object'])
    cxy = b.node('ShaderNodeCombineXYZ'); b.L.new(x, cxy.inputs['X']); b.L.new(y, cxy.inputs['Y'])
    r = b.vmath('LENGTH', cxy.outputs[0])
    far = b.smooth(far_r[0], far_r[1], r)
    hz_decay = b.smooth(520.0, 360.0, z)
    hz = b.mul(b.flt(far, haze, far_haze), hz_decay)
    d = b.add(b.mul(b.math('EXPONENT', b.mul(z, -k)), base), hz)
    mult = b.node('ShaderNodeValue'); mult.name = 'nw_fog_mult'; mult.outputs[0].default_value = 1.0
    b.L.new(b.mul(d, mult.outputs[0]), vol.inputs['Density'])
    cn = b.node('ShaderNodeRGB'); cn.name = 'nw_fog_near'; cn.outputs[0].default_value = srgb(FOG_NEAR_COL)
    cf = b.node('ShaderNodeRGB'); cf.name = 'nw_fog_far'; cf.outputs[0].default_value = srgb(FOG_FAR_COL)
    b.L.new(b.col(far, cn.outputs[0], cf.outputs[0]), vol.inputs['Color'])
    b.L.new(vol.outputs[0], out.inputs['Volume'])
    me.materials.append(m)
    o.hide_select = True
    return o


def render(scene, cam, path, res=(1280, 720), samples=32):
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.eevee.taa_render_samples = samples
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = {}
    win = getattr(bpy.context, 'window', None)
    if win is not None:
        kw['window'] = win
    with bpy.context.temp_override(scene=scene, **kw):
        bpy.ops.render.render(write_still=True, scene=scene.name)
    return path


# ───────────────────────────── Task 4: 밤 발광 · 무드 · 그린 이미지 · 먼 클립
# 밤 발광 계약
# - 장면 사용자 속성 nw_night(0 = 낮·흐림, 1 = 밤)을 재질이 Attribute(VIEW_LAYER) 노드로 읽는다(뷰 레이어 → 장면 → 월드
#   순으로 찾는다). 발광 세기 = day + night·nw_night. apply_mood() 가 이 값을 바꾼다. 저장 파일에는 0(흐림)으로 남는다.
# - 재질 사용자 속성 nw_emit(JSON) = {"color": hex 또는 null(텍스처), "tex": 이미지 이름 또는 null, "day": 세기, "night": 세기}.
#   glTF 내보내기는 노드 수식을 옮기지 못하므로 Task 5/6 이 이 값으로 emissive 를 만든다(웹은 밤 프리셋으로 곱한다).
# - 객체 사용자 속성 nw_night=1 = 밤에 켜지는 발광을 가진 객체(Task 3 간판 글자 포함).
NIGHT_PROP = 'nw_night'


def night_attr(b):
    """장면 속성 nw_night 를 읽는 소켓(0..1)."""
    return b.node('ShaderNodeAttribute', attribute_type='VIEW_LAYER', attribute_name=NIGHT_PROP).outputs['Fac']


def emit_strength(b, day, night):
    """발광 세기 소켓 = day + night·nw_night. night 가 0 이면 상수 day 를 돌려준다."""
    if not night:
        return day
    return b.add(day, b.mul(night_attr(b), night))


def emit_meta(m, color=None, tex=None, day=0.0, night=0.0, **extra):
    d = {'color': color, 'tex': tex, 'day': day, 'night': night}
    d.update(extra)
    m['nw_emit'] = json.dumps(d, ensure_ascii=False)
    if night:
        m[NIGHT_PROP] = 1
    return m


def night_hook(m, strength=4.0):
    """밤 발광 후보 재질(사용자 속성 nw_night)에 '밤에만 켜지는' 발광을 단다. 낮(nw_night=0)에는 렌더가 바뀌지 않는다.
    발광색 = Principled 의 Base Color 입력(텍스처면 그 출력, 아니면 기본값). 이미 달았으면(노드 NW_night_emit) 세기만 갱신.
    다른 스크립트가 만든 재질(Task 3 간판 글자)을 고칠 때도 노드 트리의 나머지는 건드리지 않는다."""
    if m is None or not m.use_nodes:
        return None
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return None
    b = NB(nt)
    mul = nt.nodes.get('NW_night_emit')
    if mul is None:
        attr = b.node('ShaderNodeAttribute', attribute_type='VIEW_LAYER', attribute_name=NIGHT_PROP)
        attr.name = 'NW_night_attr'
        mul = b.node('ShaderNodeMath', operation='MULTIPLY'); mul.name = 'NW_night_emit'
        b.L.new(attr.outputs['Fac'], mul.inputs[0])
        bc = bsdf.inputs['Base Color']
        ec = bsdf.inputs['Emission Color']
        for l in list(ec.links):
            nt.links.remove(l)
        if bc.links:
            b.L.new(bc.links[0].from_socket, ec)
        else:
            ec.default_value = bc.default_value
        for l in list(bsdf.inputs['Emission Strength'].links):
            nt.links.remove(l)
        b.L.new(mul.outputs[0], bsdf.inputs['Emission Strength'])
    mul.inputs[1].default_value = strength
    emit_meta(m, None, 'Base Color', 0.0, strength)
    return mul


def save_image(name, rgba, path, tag=None, noncolor=False):
    """rgba: numpy (h, w, 4) sRGB 0..1(아래 행부터) → PNG 로 저장하고 파일에서 다시 읽은 이미지 데이터블록을 돌려준다(결정적)."""
    h, w = rgba.shape[:2]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = bpy.data.images.get(name)
    if im is not None and (im.size[0] != w or im.size[1] != h):
        bpy.data.images.remove(im); im = None
    if im is None:
        im = bpy.data.images.new(name, w, h, alpha=True)
    im.pixels.foreach_set(rgba.astype('float32').ravel())
    im.filepath_raw = path; im.file_format = 'PNG'
    im.save()
    im.source = 'FILE'; im.filepath = path
    im.reload()
    if noncolor:
        im.colorspace_settings.is_data = True
    if tag:
        im[tag] = 1
    return im


def set_far_clip(scene, end=FAR_CLIP):
    """모든 CAM_* 카메라의 clip_end 를 원경 링(≤ 6 km) 너머로. ground.py·present.py 는 3000 으로 두므로 그 뒤에 부른다."""
    out = []
    for o in scene.objects:
        if o.type == 'CAMERA' and o.name.startswith('CAM_'):
            o.data.clip_end = max(o.data.clip_end, end)
            out.append(o.name)
    return out


# 무드(§2.4). 'overcast' = Task 2·3 이 만든 기본 상태(저장 파일 상태). 'night' = 비 갠 뒤 젖은 노면에 네온.
NIGHT_COLL = 'NW_fx_night'          # 밤에만 켜는 조명(가로등 웅덩이·LED 반사광·건물 조명) — 내보내지 않는다
MOODS = {
    'overcast': dict(night=0.0, exposure=EXPOSURE_OVERCAST, fog_mult=1.0, fog_near=FOG_NEAR_COL, fog_far=FOG_FAR_COL, sun=True),
    'night': dict(night=1.0, exposure=0.55, fog_mult=0.85, fog_near='#6E7A8C', fog_far='#3E4A62', sun=False,
                  hdri='modern_buildings_night_1k.hdr', hdri_strength=0.10, sky=('#2A3550', '#0B1020'), sky_strength=1.0,
                  light_sky=0.35),
}


def setup_night_world(scene, hdri, hdri_strength, sky, sky_strength, light_sky):
    """밤 월드 NW_World_night: 카메라에는 어두운 하늘 그라데이션(지평선 sky[0] → 천정 sky[1]),
    조명·반사에는 밤 HDRI(약하게) + 같은 그라데이션. 흐림 월드(NW_World)는 건드리지 않는다."""
    w = bpy.data.worlds.get('NW_World_night') or bpy.data.worlds.new('NW_World_night')
    w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear(); b = NB(nt)
    out = b.node('ShaderNodeOutputWorld')
    tc = b.node('ShaderNodeTexCoord')
    env = b.node('ShaderNodeTexEnvironment'); env.image = img(os.path.join(SRC, 'hdri', hdri))
    b.L.new(tc.outputs['Generated'], env.inputs['Vector'])
    bg = b.node('ShaderNodeBackground'); b.L.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = hdri_strength
    _, _, z = b.sepxyz(tc.outputs['Generated'])
    ramp = b.node('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position = 0.0; el[0].color = srgb(sky[0])
    el[1].position = 0.6; el[1].color = srgb(sky[1])
    b.L.new(b.math('POWER', b.math('MAXIMUM', z, 0.0), 0.6), ramp.inputs['Fac'])
    sky_bg = b.node('ShaderNodeBackground'); b.L.new(ramp.outputs['Color'], sky_bg.inputs['Color'])
    sky_bg.inputs['Strength'].default_value = sky_strength
    below = b.smooth(0.0, -0.12, z)
    lsky = b.col(below, ramp.outputs['Color'], srgb('#07090C'))
    lbg = b.node('ShaderNodeBackground'); b.L.new(lsky, lbg.inputs['Color'])
    lbg.inputs['Strength'].default_value = sky_strength
    lmix = b.node('ShaderNodeMixShader'); lmix.inputs['Fac'].default_value = light_sky
    b.L.new(bg.outputs[0], lmix.inputs[1]); b.L.new(lbg.outputs[0], lmix.inputs[2])
    lp = b.node('ShaderNodeLightPath')
    mix = b.node('ShaderNodeMixShader')
    b.L.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    b.L.new(lmix.outputs[0], mix.inputs[1]); b.L.new(sky_bg.outputs[0], mix.inputs[2])
    b.L.new(mix.outputs[0], out.inputs['Surface'])
    try:
        w.sun_threshold = 1000.0      # 밤 HDRI 의 가로등을 해로 뽑지 않는다
    except Exception:
        pass
    return w


def apply_mood(scene, mood='overcast', bake=True):
    """무드를 바꾼다. 'night' 로 렌더한 뒤 반드시 apply_mood(scene, 'overcast') 로 되돌린다(저장 파일 = 흐림).
    바꾸는 것: 장면 nw_night(발광 재질), 월드, 키 라이트(FX_sun) 켜고 끔, 안개 색·밀도, 노출, 밤 조명 컬렉션,
    nw_night 재질의 밤 발광 연결(night_hook, 이미 있으면 그대로), 볼륨 프로브 다시 굽기(bake=True)."""
    m = MOODS[mood]
    scene[NIGHT_PROP] = float(m['night'])
    for vl in scene.view_layers:
        if NIGHT_PROP in vl.keys():
            del vl[NIGHT_PROP]                 # 뷰 레이어 값이 장면 값을 가리지 않게
    nightw = bpy.data.worlds.get('NW_World_night')
    if mood == 'overcast':
        w = bpy.data.worlds.get('NW_World')
        if w is None:
            w = setup_world(scene)
        scene.world = w
        if nightw is not None:
            bpy.data.worlds.remove(nightw)     # 밤 월드는 남기지 않는다(데이터블록 누수 방지)
    else:
        scene.world = setup_night_world(scene, m['hdri'], m['hdri_strength'], m['sky'], m['sky_strength'], m['light_sky'])
    sun = bpy.data.objects.get('FX_sun')
    if sun is not None:
        sun.hide_render = not m['sun']
        sun.hide_viewport = not m['sun']
    fm = bpy.data.materials.get('NW_fog')
    if fm is not None and fm.node_tree is not None:
        N = fm.node_tree.nodes
        if N.get('nw_fog_mult'):
            N['nw_fog_mult'].outputs[0].default_value = m['fog_mult']
        if N.get('nw_fog_near'):
            N['nw_fog_near'].outputs[0].default_value = srgb(m['fog_near'])
        if N.get('nw_fog_far'):
            N['nw_fog_far'].outputs[0].default_value = srgb(m['fog_far'])
    scene.view_settings.exposure = m['exposure']
    nc = bpy.data.collections.get(NIGHT_COLL)
    if nc is not None:
        nc.hide_render = m['night'] < 0.5
        nc.hide_viewport = m['night'] < 0.5
    for mat in bpy.data.materials:
        if mat.get(NIGHT_PROP) and mat.node_tree is not None and mat.node_tree.nodes.get('NW_night_emit') is None \
                and 'nw_emit' not in mat.keys():
            night_hook(mat)
    out = {'mood': mood, 'world': scene.world.name}
    if bake:
        out['probes'] = bake_light_probes(scene)
    return out
