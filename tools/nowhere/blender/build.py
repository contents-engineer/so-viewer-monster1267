# HAUS NOWHERE — 성수 2041 / Task 5: 헤드리스 전체 빌드 엔트리포인트.
# 실행:
#   /Applications/Blender.app/Contents/MacOS/Blender -b build/nowhere/nowhere.blend --python tools/nowhere/blender/build.py
#   (전체 재구축 시 끝에 -- --rebuild, 강제 재굽기 시 -- --bake, 굽기를 건너뛰는 빠른 빌드는 -- --no-bake 전달.
#    --no-bake 로 만든 장면은 nw_baked=False 로 저장되어 다음 일반 빌드가 굽는다.
#    -- --hero-from-captures 를 주면 build/nowhere/renders/hero-*.png(웹 캡처, README §2)로 출하 renders/*.webp 를 다시 만든다)
#
# 단계:
#   1) nowhere.blend 가 없거나 --rebuild 플래그가 있으면 ground → present → future → backdrop 순으로 장면을 구축한다.
#   2) bake.bake() 를 실행해 2048×2048 지면 마스크(nowhere-ground-mask.webp)와 정점 AO(nw_mask)를 굽고 nowhere.blend 에 저장한다.
#   3) export.export_all() 을 실행해 layout.json, sky-1k.hdr, build/nowhere/raw/nowhere-{ground,present,future,backdrop}.glb 를 내보낸다
#      (renders/*.webp 는 --hero-from-captures 일 때만).
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
    no_bake = '--no-bake' in argv
    force_bake = ('--bake' in argv or rebuild) and not no_bake
    hero_from_captures = '--hero-from-captures' in argv

    t0 = time.time()
    blend_path = os.path.join(lib.OUT, 'nowhere.blend')

    if rebuild or not os.path.exists(blend_path):
        print('[nowhere:build] Building scene from scratch (ground -> present -> future -> backdrop)...')
        import ground, present, future, backdrop
        importlib.reload(ground)
        importlib.reload(present)
        importlib.reload(future)
        importlib.reload(backdrop)
        # 각 build() 는 인자가 없고 자기 컬렉션을 비운 뒤 다시 만든다(예전의 reset=/render_previews= 인자는 TypeError 였다)
        ground.build()
        present.build()
        future.build()
        backdrop.build()
        _save_blend(lib.get_scene(True), blend_path)
    elif bpy.data.scenes.get(lib.SCENE_NAME) is None:
        print(f'[nowhere:build] Opening {blend_path}...')
        bpy.ops.wm.open_mainfile(filepath=blend_path)

    sc = lib.get_scene(True)

    import bake, export
    importlib.reload(bake)
    importlib.reload(export)

    if no_bake:
        print('[nowhere:build] --no-bake: 굽기를 건너뛴다(새 메시 AO = 1). 확인 지점에서는 전체 굽기로 다시 만든다.')
        sc['nw_baked'] = False                 # 다음 일반 빌드가 굽기를 하도록 표시
        _save_blend(sc, blend_path)
    elif force_bake or not sc.get('nw_baked') or not os.path.exists(bake.MASK_OUT):
        print('[nowhere:build] Running bake (ground mask + Cycles vertex AO)...')
        bake.bake()
        sc['nw_baked'] = True
        _save_blend(sc, blend_path)
    else:
        print('[nowhere:build] Scene already baked (nw_baked=True); skipping bake.')

    print('[nowhere:build] Running export_all()...')
    export.export_all(hero_from_captures)
    print(f'[nowhere:build] Done in {round(time.time() - t0, 1)} s')


if __name__ == '__main__':
    main()
