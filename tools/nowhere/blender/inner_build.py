# HAUS NOWHERE — 성수(HAUS NOWHERE) 실내 뷰 빌드 파이프라인.
# 층마다 새 장면 → 껍데기 · 전시물 배치 → 데스크톱 GLB · 미리보기 → 전시물 추가 감축 → 모바일 GLB → inner-layout.json · HDRI.
# 실행: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/nowhere/blender/inner_build.py
# 일부 층만: NW_FLOORS=b1,12 (레이아웃 JSON 은 항상 모든 층으로 쓴다)
# 산출: build/nowhere/raw-inner/inner-<층>.glb · raw-inner/mobile/inner-<층>.glb · build/nowhere/renders/inner-<층>.png
#       public/assets/nowhere-inner/{inner-layout.json, env-1k.hdr, renders/inner-<층>.webp}
import bpy, os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import inner_common as K
from inner_floors import FLOORS


def materials(F):
    t = F['floor_tex']
    return {
        'floor': K.mat_tiled(f"IN_floor_{F['id']}", os.path.join(K.SRC, t['dir'], t['diffuse']), os.path.join(K.SRC, t['dir'], t['normal']), tile=t['tile'], rough=t['rough']),
        'concrete': K.mat_flat('IN_concrete', '#CFCBC3', 0.9),
        'ceiling': K.mat_flat('IN_ceiling_mat', '#E4E1DA', 0.95),
        'core': K.mat_flat('IN_core_mat', '#3A3B3D', 0.7),
        'plinth': K.mat_flat('IN_plinth_mat', '#2B2C2E', 0.6),
        'glass': K.mat_flat('IN_glass_mat', '#B9C7CC', 0.05, 0.0, alpha=0.22),
        'mullion': K.mat_flat('IN_mullion_mat', '#2F3133', 0.4, 0.6),
        'brass': K.mat_flat('EX_brass_mat', '#B08D57', 0.35, 0.8),
        'screen': K.mat_flat('EX_screen_mat', '#05070A', 0.3),
    }


def export_glb(c, path):
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
    bg.inputs['Color'].default_value = (*K._lin('#C9CECD'), 1.0)
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
    im.filepath_raw = os.path.join(K.PUB, 'renders', f"inner-{F['id']}.webp")
    im.file_format = 'WEBP'
    im.save()


def mobile_variant(c):
    """모바일: 전시물(EX_*, 받침대 · 명판 · 화면 제외)을 하나당 MOBILE_MAX_TRIS 로 더 줄인다."""
    for o in list(c.all_objects):
        if o.type == 'MESH' and o.name.startswith('EX_') and not o.name.startswith(('EX_plinth', 'EX_nameplate', 'EX_display_screen')):
            K.decimate_to(o, K.MOBILE_MAX_TRIS)


def export_env():
    im = bpy.data.images.load(os.path.join(K.SRC, 'env', 'modern_bathroom_1k.exr'))
    _ = im.pixels[0]  # 위와 같은 이유로 경로 변경 전에 픽셀 로드
    im.filepath_raw = os.path.join(K.PUB, 'env-1k.hdr')
    im.file_format = 'HDR'
    im.save()


def main():
    t0 = time.time()
    only = {s.strip() for s in os.environ.get('NW_FLOORS', '').split(',') if s.strip()}
    for d in (K.RAW, K.RAW_MOBILE, K.PUB, os.path.join(K.PUB, 'renders'), os.path.join(K.PUB, 'mobile'), os.path.join(K.ROOT, 'build', 'nowhere', 'renders')):
        os.makedirs(d, exist_ok=True)
    for F, builder in FLOORS:
        if only and F['id'] not in only:
            continue
        K.reset_scene()   # 층마다 새 장면 — 미리보기 · AO 에 다른 층이 섞이지 않게
        M = materials(F)
        c = K.coll(f"INNER_{F['id']}")
        builder(c, M)
        export_glb(c, os.path.join(K.RAW, f"inner-{F['id']}.glb"))
        render_preview(F, os.path.join(K.ROOT, 'build', 'nowhere', 'renders', f"inner-{F['id']}.png"))
        mobile_variant(c)
        export_glb(c, os.path.join(K.RAW_MOBILE, f"inner-{F['id']}.glb"))
    K.reset_scene()
    export_env()
    layout = {'building': 'haus', 'defaultFloor': '1', 'env': 'assets/nowhere-inner/env-1k.hdr', 'floors': [K.floor_json(F) for F, _ in FLOORS]}
    with open(os.path.join(K.PUB, 'inner-layout.json'), 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'[inner_build] done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
