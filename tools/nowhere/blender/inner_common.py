# HAUS NOWHERE — 성수 실내 빌드 공용 도구: 경로 · 재질 · 상자 · 에셋 가져오기(Draco) · 감축 · 껍데기(띠창 · 커튼월 · 코어 · 기둥) · 층 JSON.
# inner_build.py(파이프라인) · inner_floors.py(층 정의)가 쓴다. 좌표: Blender Z-up m, 층 원점 = 바닥 중앙 부근. 웹(Three.js)은 (x, z, −y).
# 노드 이름 규칙(웹 interior.js 가 씀): 바닥 IN_floor*, 천장 IN_ceiling*, 벽 · 유리 · 기둥 · 코어 IN_*, 전시물 EX_*.
import bpy, bmesh, os, math
import numpy as np
from mathutils import Vector, Matrix

ROOT = os.environ.get('NW_ROOT') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SRC = os.path.join(ROOT, 'public', 'assets', 'inner')
RAW = os.path.join(ROOT, 'build', 'nowhere', 'raw-inner')
RAW_MOBILE = os.path.join(RAW, 'mobile')
PUB = os.path.join(ROOT, 'public', 'assets', 'nowhere-inner')
MAX_TRIS = 50000          # 데스크톱: 전시물 하나당 삼각형 상한(넘으면 Decimate)
MOBILE_MAX_TRIS = 20000   # 모바일: 전시물 하나당 상한(층당 30만 이하 — 스펙 §2.7)


def to_three(v):
    return [round(float(v[0]), 3), round(float(v[2]), 3), round(float(-v[1]), 3)]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def coll(name):
    sc = bpy.context.scene
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in sc.collection.children:
        sc.collection.children.link(c)
    return c


def _lin(hexcol):
    h = hexcol.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def mat_flat(name, hexcol, rough=0.85, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*_lin(hexcol), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


def mat_tiled(name, diffuse, normal, tile=2.0, rough=0.6):
    """바닥 재질: 원본 텍스처를 tile m 간격으로 반복(glTF KHR_texture_transform 으로 내보내짐)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    uv = nt.nodes.new('ShaderNodeUVMap')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 / tile, 1.0 / tile, 1.0)
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
    td = nt.nodes.new('ShaderNodeTexImage')
    td.image = bpy.data.images.load(diffuse, check_existing=True)
    nt.links.new(mp.outputs['Vector'], td.inputs['Vector'])
    nt.links.new(td.outputs['Color'], bsdf.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(normal, check_existing=True)
    tn.image.colorspace_settings.name = 'Non-Color'
    nt.links.new(mp.outputs['Vector'], tn.inputs['Vector'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def box(name, c, x0, y0, z0, x1, y1, z1, mat):
    """축 정렬 상자(면 주축 박스 투영 UV, m 단위)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((x0 if v.co.x < 0 else x1, y0 if v.co.y < 0 else y1, z0 if v.co.z < 0 else z1))
    bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        ax = max(range(3), key=lambda i: abs(f.normal[i]))
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.y, co.z) if ax == 0 else (co.x, co.z) if ax == 1 else (co.x, co.y)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def plane(name, c, x0, y0, x1, y1, z, mat):
    """위를 보는 수평 사각형 한 장(UV 'UVMap' = x, y m 단위). 바닥 — AO 굽기는 면이 겹치지 않는 평면이어야 한다."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = (co.x, co.y)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def gltf_output_group():
    """glTF 내보내기가 occlusion 을 읽는 노드 그룹('glTF Material Output', 입력 Occlusion)."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def bake_floor_ao(floor, tag, size=1024, samples=48, distance=4.5, gamma=1.8):
    """바닥(IN_floor 평면)에 AO 를 굽는다: 두 번째 UV 'AO'(바닥 전체 0…1) + 이미지 → glTF occlusionTexture(texCoord 1).
    벽 · 기둥 · 전시물 아래 접지 그늘만 굽고, 실시간 조명(반구광 · 방향광)은 웹에서 그대로 쓴다.
    웹 aoMap 은 간접광에만 곱해지고 세기를 1 넘게 올리면 음수가 되므로, 그늘의 넓이 · 진하기는 여기서 정한다:
    천장은 굽기에서 빼고(천고 4 m 보다 넓은 거리에서도 바닥 전체가 고르게 어두워지지 않게) 거리를 넓힌 뒤,
    감마(gamma > 1)로 중간 톤을 진하게 한다(1 = 열린 바닥은 그대로 1)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.render.bake.target = 'IMAGE_TEXTURES'
    w = sc.world or bpy.data.worlds.new('IN_bake_world')
    sc.world = w
    w.light_settings.distance = distance   # AO 거리(m)
    me = floor.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    uv = me.uv_layers.new(name='AO')
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = ((co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0))
    img = bpy.data.images.new(f'IN_floor_ao_{tag}', size, size, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    nt = me.materials[0].node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    uvn = nt.nodes.new('ShaderNodeUVMap')
    uvn.uv_map = 'AO'
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    for n in nt.nodes:
        n.select = False
    tex.select = True
    nt.nodes.active = tex          # 굽기 대상 이미지(바닥 무늬 텍스처가 아니라 이 노드)
    bpy.ops.object.select_all(action='DESELECT')
    floor.select_set(True)
    bpy.context.view_layer.objects.active = floor
    ceil = bpy.data.objects.get('IN_ceiling')
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    normal_src = [l.from_socket for l in bsdf.inputs['Normal'].links]
    for l in list(bsdf.inputs['Normal'].links):
        nt.links.remove(l)   # 바닥 노멀맵은 굽기 동안 끊는다(AO 에 타일 격자가 찍히지 않게) — 끝나면 다시 잇는다
    if ceil:
        ceil.hide_render = True
    try:
        bpy.ops.object.bake(type='AO', margin=4, use_clear=True, uv_layer='AO')   # 굽기는 활성 UV(UVMap)를 쓰므로 'AO' 로 지정
    finally:
        if ceil:
            ceil.hide_render = False
        for s in normal_src:
            nt.links.new(s, bsdf.inputs['Normal'])
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgb = px.reshape(-1, 4)[:, :3]
    if rgb.mean() < 0.2:   # 굽기 UV · 대상 노드가 어긋나면 전부 검게 구워진다(실제로 있었던 실패)
        raise RuntimeError(f'AO bake {tag}: mean {rgb.mean():.3f} — 거의 검은 AO')
    rgb[:] = np.power(rgb, gamma)
    img.pixels.foreach_set(px)
    path = os.path.join(RAW, 'ao', f'inner-{tag}-ao.png')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
    grp = nt.nodes.new('ShaderNodeGroup')
    grp.node_tree = gltf_output_group()
    nt.links.new(sep.outputs['Red'], grp.inputs['Occlusion'])
    print(f'[inner_build] AO baked {path}')


def quad_x(name, c, x, y0, z0, y1, z1, mat):
    """+x 를 향하는 세로 사각형 한 장(UV: 왼→오 = +y, 아래→위 = +z, 0…1) — 1F 디스플레이 화면."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for lp, (u, v) in zip(me.loops, ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))):
        uv.data[lp.index].uv = (u, v)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def display_screen(disp, c, mat, inset=0.04, slab=0.05):
    """display 소품(rz=90 으로 화면이 +x 를 봄)의 가장 앞(+x) slab m 안 정점 범위에, 1 cm 앞으로 화면 사각형 EX_display_screen 을 붙인다.
    inset 비율만큼 테두리를 남긴다. 웹(inner-display.js)이 이 메시에 CanvasTexture 를 입힌다."""
    bpy.context.view_layer.update()
    mw = disp.matrix_world
    pts = [mw @ v.co for v in disp.data.vertices]
    front = max(p.x for p in pts)
    face = [p for p in pts if p.x >= front - slab]
    y0, y1 = min(p.y for p in face), max(p.y for p in face)
    z0, z1 = min(p.z for p in face), max(p.z for p in face)
    dy, dz = (y1 - y0) * inset, (z1 - z0) * inset
    return quad_x('EX_display_screen', c, front + 0.01, y0 + dy, z0 + dz, y1 - dy, z1 - dz, mat)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def decimate_to(obj, max_tris):
    """삼각형이 max_tris 를 넘으면 Decimate(Collapse)로 줄이고 결과 삼각형 수를 돌려준다."""
    tris = tri_count(obj)
    if tris <= max_tris:
        return tris
    # UV 이음매로 갈라진 정점(같은 자리)을 먼저 용접 — 갈라진 채로 두면 Collapse 가 조각마다 오그라뜨려 구멍이 난다
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(obj.data)
    bm.free()
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = max_tris / tris
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.validate(clean_customdata=False)   # 용접한 메시를 감축하면 겹친 면이 생김 — 정리(남기면 glTF 내보내기가 "not valid" 경고)
    return tri_count(obj)


def import_prop(rel, name, c, loc, height=None, width=None, rz=0.0):
    """inner 에셋(Draco GLB)을 불러와 하나로 합치고, 바닥 중앙 원점 · 목표 높이(또는 폭) 축척 · 회전 · 위치 · 감축."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, rel))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    if not meshes:
        raise RuntimeError(f'메시 없는 에셋: {rel}')
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o.name in bpy.data.objects and o != obj and o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    for uc in list(obj.users_collection):
        uc.objects.unlink(obj)
    c.objects.link(obj)
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    size = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    s = height / size[2] if height else width / max(size[0], size[1])
    off = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs)))
    obj.data.transform(Matrix.Translation(-off))
    obj.data.transform(Matrix.Scale(s, 4))
    obj.location = loc
    obj.rotation_mode = 'XYZ'  # glTF 가져오기는 QUATERNION 모드라 그대로면 rotation_euler 가 무시됨
    obj.rotation_euler = (0.0, 0.0, math.radians(rz))
    decimate_to(obj, MAX_TRIS)
    obj.name = name
    obj.data.name = name
    return obj


# 포디움(1F) 가로 띠창: 솔리드 · 유리 띠 교차(외관 포디움과 같은 리듬). z1 이 None 이면 층고까지
BANDS_PODIUM = ((0.0, 1.0, 'wall'), (1.0, 2.6, 'glass'), (2.6, 3.6, 'wall'), (3.6, 5.0, 'glass'), (5.0, None, 'wall'))


def ribbon(c, M, tag, x0, y0, x1, y1, H, bands=BANDS_PODIUM):
    for i, (z0, z1, kind) in enumerate(bands):
        mat = M['concrete'] if kind == 'wall' else M['glass']
        pre = 'IN_wall' if kind == 'wall' else 'IN_glass'
        box(f'{pre}_{tag}_{i}', c, x0, y0, z0, x1, y1, H if z1 is None else z1, mat)


def curtain(c, M, tag, x0, y0, x1, y1, H, step=3.0):
    """타워 층 커튼월: 바닥 턱(0.25 m) · 전면 유리 · 천장 쪽 띠(0.35 m) · step m 간격 멀리언. 벽 하나 = (x0, y0)-(x1, y1) 띠."""
    box(f'IN_wall_{tag}_sill', c, x0, y0, 0.0, x1, y1, 0.25, M['concrete'])
    box(f'IN_glass_{tag}', c, x0, y0, 0.25, x1, y1, H - 0.35, M['glass'])
    box(f'IN_wall_{tag}_head', c, x0, y0, H - 0.35, x1, y1, H, M['concrete'])
    along_x = (x1 - x0) >= (y1 - y0)
    start, end = (x0, x1) if along_x else (y0, y1)
    i = 1
    t = start + step
    while t < end - 0.5:
        if along_x:
            box(f'IN_mullion_{tag}_{i}', c, t - 0.05, y0, 0.25, t + 0.05, y1, H - 0.35, M['mullion'])
        else:
            box(f'IN_mullion_{tag}_{i}', c, x0, t - 0.05, 0.25, x1, t + 0.05, H - 0.35, M['mullion'])
        i += 1
        t += step


def elevator_core(c, M, y_front, y_back, H):
    """엘리베이터 코어(x −5…5, 북측) + 문 door_1 두 짝(코어 앞 0.2 m, 높이 2.6 m). 모든 층이 같은 모양 — 내리면 남쪽을 본다."""
    box('IN_core', c, -5.0, y_front, 0.0, 5.0, y_back, H, M['core'])
    import_prop('main/door_1.glb', 'EX_elevator_l', c, (-2.5, y_front - 0.2, 0.0), height=2.6)
    import_prop('main/door_1.glb', 'EX_elevator_r', c, (2.5, y_front - 0.2, 0.0), height=2.6)


def columns(c, M, pts, H, half=0.4):
    for i, (x, y) in enumerate(pts):
        box(f'IN_column_{i}', c, x - half, y - half, 0.0, x + half, y + half, H, M['concrete'])


def floor_json(F):
    x0, y0, x1, y1 = F['bounds_bl']
    j = {
        'id': F['id'], 'label': F['label'], 'glb': F['glb'], 'mobileGlb': F['mobileGlb'],
        'elevation': F['elevation'], 'bounds': [x0, -y1, x1, -y0], 'ceiling': F['ceiling'],
        'spawn': {'pos': to_three(F['spawn'][0]), 'target': to_three(F['spawn'][1])},
        'elevator': {'pos': to_three(F['elevator'][0]), 'radius': F['elevator'][1]},
        'exhibits': [{'id': i, 'title': t, 'desc': d, 'pos': to_three(p)} for i, t, d, p in F['exhibits']],
        'tour': [{'pos': to_three(p), 'target': to_three(q), 'caption': cap, 'duration': dur} for p, q, cap, dur in F['tour']],
    }
    if 'entry' in F:
        j['entry'] = {'pos': to_three(F['entry'][0]), 'target': to_three(F['entry'][1])}
    if 'exit' in F:
        j['exit'] = {'pos': to_three(F['exit'][0]), 'radius': F['exit'][1]}
    return j
