# HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰 / 층별 전시 공간 빌드 (1단계: 1F 로비).
# 실행: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/nowhere/blender/inner_build.py
# 산출: build/nowhere/raw-inner/inner-<층>.glb · public/assets/nowhere-inner/{inner-layout.json, env-1k.hdr, renders/inner-<층>.webp}
# 좌표: Blender Z-up m, 층 원점 = 바닥 중앙. 웹(Three.js)은 (x, z, −y).
# 노드 이름 규칙(웹 interior.js 가 씀): 바닥 IN_floor*, 천장 IN_ceiling*, 벽 · 유리 · 기둥 · 코어 IN_*, 전시물 EX_*.
import bpy, bmesh, os, math, json, time
from mathutils import Vector, Matrix

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
SRC = os.path.join(ROOT, 'public', 'assets', 'inner')
RAW = os.path.join(ROOT, 'build', 'nowhere', 'raw-inner')
PUB = os.path.join(ROOT, 'public', 'assets', 'nowhere-inner')
MAX_TRIS = 50000      # 전시물 하나당 삼각형 상한(넘으면 Decimate)


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


def import_prop(rel, name, c, loc, height=None, width=None, rz=0.0):
    """inner 에셋(Draco GLB)을 불러와 하나로 합치고, 바닥 중앙 원점 · 목표 높이(또는 폭) 축척 · 회전 · 위치 · 감축."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, rel))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
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
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > MAX_TRIS:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = MAX_TRIS / tris
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.name = name
    obj.data.name = name
    return obj


# ═════════════ 1F 로비 ═════════════
# Blender 평면: x −17…17, y −17…21(남측 y −17 정문, 북측 y +21 엘리베이터 코어), 층고 6 m.
FLOOR_1 = {
    'id': '1', 'label': '1F 로비',
    'glb': 'assets/nowhere-inner/inner-1.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-1.glb',
    'elevation': 0.0, 'bounds_bl': (-17.0, -17.0, 17.0, 21.0), 'ceiling': 6.0,
    'entry': ((0.0, -13.0, 1.7), (0.0, 0.0, 2.5)),
    'spawn': ((0.0, 15.0, 1.7), (0.0, 0.0, 2.5)),
    'exit': ((0.0, -16.0, 0.0), 2.0),
    'elevator': ((0.0, 19.0, 0.0), 2.5),
    'exhibits': [
        ('city_model', '성수 도시 모형', 'HAUS NOWHERE 미니어처와 성수의 그래피티 건물들', (0.0, 0.0, 1.5)),
        ('dj', 'DJ 부스', '로비의 사운드 설치물', (10.5, 9.0, 1.2)),
        ('display', '디스플레이 월', 'HAUS NOWHERE SEOUL · 현재 시각 · 기상', (-16.4, 6.0, 2.4)),
    ],
    'tour': [
        ((6.0, -8.0, 2.2), (0.0, 0.0, 1.8), '성수 도시 모형 — HAUS NOWHERE 와 성수 골목', 5),
        ((4.0, 3.0, 1.8), (10.5, 9.0, 1.2), 'DJ 부스 — 로비의 사운드 설치물', 4),
        ((-8.0, 2.0, 2.4), (-16.4, 6.0, 2.4), '디스플레이 월', 4),
    ],
}


def build_floor_1(c, M):
    X0, Y0, X1, Y1 = FLOOR_1['bounds_bl']
    H = FLOOR_1['ceiling']
    T = 0.3
    box('IN_floor', c, X0 - T, Y0 - T, -0.2, X1 + T, Y1 + T, 0.0, M['floor_1'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    # 외관 포디움과 같은 가로 띠창(솔리드 · 유리 띠 교차)
    bands = [(0.0, 1.0, 'wall'), (1.0, 2.6, 'glass'), (2.6, 3.6, 'wall'), (3.6, 5.0, 'glass'), (5.0, H, 'wall')]

    def ribbon(tag, x0, y0, x1, y1):
        for i, (z0, z1, kind) in enumerate(bands):
            mat = M['concrete'] if kind == 'wall' else M['glass']
            pre = 'IN_wall' if kind == 'wall' else 'IN_glass'
            box(f'{pre}_{tag}_{i}', c, x0, y0, z0, x1, y1, z1, mat)

    # 남측: 정문 열림(x −3…3, z 0…3.4) 양옆 띠창 + 문 위 인방 · 유리 · 벽
    ribbon('sw', X0 - T, Y0 - T, -3.0, Y0)
    ribbon('se', 3.0, Y0 - T, X1 + T, Y0)
    box('IN_wall_s_lintel', c, -3.0, Y0 - T, 3.4, 3.0, Y0, 3.6, M['concrete'])
    box('IN_glass_s_top', c, -3.0, Y0 - T, 3.6, 3.0, Y0, 5.0, M['glass'])
    box('IN_wall_s_top', c, -3.0, Y0 - T, 5.0, 3.0, Y0, H, M['concrete'])
    # 서 · 동: 띠창, 북: 막힌 벽 + 엘리베이터 코어
    ribbon('w', X0 - T, Y0, X0, Y1)
    ribbon('e', X1, Y0, X1 + T, Y1)
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    box('IN_core', c, -5.0, 19.5, 0.0, 5.0, Y1, H, M['core'])
    for i, (x, y) in enumerate(((-11.0, -6.0), (11.0, -6.0), (-11.0, 9.0), (11.0, 9.0))):
        box(f'IN_column_{i}', c, x - 0.4, y - 0.4, 0.0, x + 0.4, y + 0.4, H, M['concrete'])
    # 성수 도시 모형: 받침대(높이 0.8 m) 위 HAUS NOWHERE 미니어처 + 그래피티 건물 3종
    box('EX_plinth', c, -4.5, -3.0, 0.0, 4.5, 3.0, 0.8, M['plinth'])
    P = 0.8
    import_prop('main/office_building.glb', 'EX_city_haus', c, (0.0, 0.0, P), height=3.0)
    import_prop('etc/building_1.glb', 'EX_city_b1', c, (-2.9, -1.2, P), height=1.6, rz=-90)
    import_prop('etc/building_2.glb', 'EX_city_b2', c, (2.9, -1.5, P), height=1.4, rz=90)
    import_prop('etc/building_3.glb', 'EX_city_b3', c, (2.8, 1.7, P), height=1.9, rz=180)
    import_prop('main/DJ.glb', 'EX_dj', c, (10.5, 9.0, 0.0), height=2.4, rz=-45)
    import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)
    import_prop('main/door_1.glb', 'EX_elevator_l', c, (-2.5, 19.45, 0.0), height=2.6)
    import_prop('main/door_1.glb', 'EX_elevator_r', c, (2.5, 19.45, 0.0), height=2.6)


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


def export_floor(c, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.all_objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_cameras=False, export_lights=False, export_extras=False, export_image_format='AUTO',
    )
    print(f'[inner_build] exported {path} ({os.path.getsize(path) / 1048576:.2f} MB)')


def render_preview(F, png):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    w = bpy.data.worlds.new('IN_world')
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (*_lin('#C9CECD'), 1.0)
    bg.inputs['Strength'].default_value = 1.0
    sc.world = w
    ld = bpy.data.lights.new('IN_key', 'AREA')
    ld.energy = 2500.0
    ld.size = 20.0
    lo = bpy.data.objects.new('IN_key', ld)
    sc.collection.objects.link(lo)
    lo.location = (0.0, 2.0, F['ceiling'] - 0.3)
    cd = bpy.data.cameras.new('IN_cam')
    cd.lens = 22.0
    cam = bpy.data.objects.new('IN_cam', cd)
    sc.collection.objects.link(cam)
    pos, tgt = F['entry'] if 'entry' in F else F['spawn']
    cam.location = pos
    cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.filepath = png
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(png)
    _ = im.pixels[0]  # 경로를 바꾸기 전에 픽셀을 메모리에 올림(안 하면 save() 가 "does not have any image data")
    im.filepath_raw = os.path.join(PUB, 'renders', f"inner-{F['id']}.webp")
    im.file_format = 'WEBP'
    im.save()


def export_env():
    im = bpy.data.images.load(os.path.join(SRC, 'env', 'modern_bathroom_1k.exr'))
    _ = im.pixels[0]  # 위와 같은 이유로 경로 변경 전에 픽셀 로드
    im.filepath_raw = os.path.join(PUB, 'env-1k.hdr')
    im.file_format = 'HDR'
    im.save()


def main():
    t0 = time.time()
    reset_scene()
    for d in (RAW, PUB, os.path.join(PUB, 'renders'), os.path.join(PUB, 'mobile')):
        os.makedirs(d, exist_ok=True)
    M = {
        'floor_1': mat_tiled('IN_floor_1', os.path.join(SRC, 'main', 'floor_diffuse.png'), os.path.join(SRC, 'main', 'floor_normal.png'), tile=1.2, rough=0.35),
        'concrete': mat_flat('IN_concrete', '#CFCBC3', 0.9),
        'ceiling': mat_flat('IN_ceiling_mat', '#E4E1DA', 0.95),
        'core': mat_flat('IN_core_mat', '#3A3B3D', 0.7),
        'plinth': mat_flat('IN_plinth_mat', '#2B2C2E', 0.6),
        'glass': mat_flat('IN_glass_mat', '#B9C7CC', 0.05, 0.0, alpha=0.22),
    }
    floors = []
    for F, builder in ((FLOOR_1, build_floor_1),):
        c = coll(f"INNER_{F['id']}")
        builder(c, M)
        export_floor(c, os.path.join(RAW, f"inner-{F['id']}.glb"))
        render_preview(F, os.path.join(ROOT, 'build', 'nowhere', 'renders', f"inner-{F['id']}.png"))
        floors.append(floor_json(F))
    export_env()
    layout = {'building': 'haus', 'defaultFloor': '1', 'env': 'assets/nowhere-inner/env-1k.hdr', 'floors': floors}
    with open(os.path.join(PUB, 'inner-layout.json'), 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print(f'[inner_build] done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
