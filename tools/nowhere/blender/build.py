# HAUS NOWHERE — 성수 2041 / Task 5: 헤드리스 전체 빌드 엔트리포인트.
# 실행:
#   /Applications/Blender.app/Contents/MacOS/Blender -b build/nowhere/nowhere.blend --python tools/nowhere/blender/build.py
#   (전체 재구축 시 끝에 -- --rebuild, 강제 재굽기 시 -- --bake 전달)
#
# 단계:
#   1) nowhere.blend 가 없거나 --rebuild 플래그가 있으면 ground → present → future → backdrop 순으로 장면을 구축한다.
#   2) bake.bake() 를 실행해 2048×2048 지면 마스크(nowhere-ground-mask.webp)와 정점 AO(nw_mask)를 굽고 nowhere.blend 에 저장한다.
#   3) export.export_all() 을 실행해 layout.json, sky-1k.hdr, renders/*.webp, build/nowhere/raw/nowhere-{ground,present,future,backdrop}.glb 를 내보낸다.
import bpy, os, sys, time, importlib

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import lib
importlib.reload(lib)


def _save_blend(sc, blend_path):
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    bpy.data.libraries.write(blend_path, {sc}, compress=True)
    print(f'[nowhere:build] Saved {blend_path} ({round(os.path.getsize(blend_path) / (1024 * 1024), 2)} MB)')


def main(argv=None):
    argv = list(sys.argv if argv is None else argv)
    rebuild = '--rebuild' in argv
    force_bake = '--bake' in argv or rebuild

    t0 = time.time()
    blend_path = os.path.join(lib.OUT, 'nowhere.blend')

    if rebuild or not os.path.exists(blend_path):
        print('[nowhere:build] Building scene from scratch (ground -> present -> future -> backdrop)...')
        import ground, present, future, backdrop
        importlib.reload(ground)
        importlib.reload(present)
        importlib.reload(future)
        importlib.reload(backdrop)
        ground.build(reset=True, render_previews=False)
        present.build(reset=False, render_previews=False)
        future.build(reset=False, render_previews=False)
        backdrop.build()
        _save_blend(lib.get_scene(True), blend_path)
    elif bpy.data.scenes.get(lib.SCENE_NAME) is None:
        print(f'[nowhere:build] Opening {blend_path}...')
        bpy.ops.wm.open_mainfile(filepath=blend_path)

    sc = lib.get_scene(True)

    import bake, export
    importlib.reload(bake)
    importlib.reload(export)

    if force_bake or not sc.get('nw_baked') or not os.path.exists(bake.MASK_OUT):
        print('[nowhere:build] Running bake (ground mask + Cycles vertex AO)...')
        bake.bake()
        sc['nw_baked'] = True
        _save_blend(sc, blend_path)
    else:
        print('[nowhere:build] Scene already baked (nw_baked=True); skipping bake.')

    print('[nowhere:build] Running export_all()...')
    export.export_all()
    print(f'[nowhere:build] Done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
