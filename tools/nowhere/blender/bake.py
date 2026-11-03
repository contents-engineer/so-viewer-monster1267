# HAUS NOWHERE — 성수 2041 / Task 5: AO · 지면 마스크 굽기.
# 실행: MCP 에서 exec(open('<ROOT>/tools/nowhere/blender/bake.py').read(), {'__name__': '__main__'})
#       헤드리스: blender -b build/nowhere/nowhere.blend --python-expr "exec(open('.../bake.py').read(), {'__name__': '__main__'})"
#
# 하는 일
#   1) NW_ground 의 nw_drive 갱신: Task 3 가 세운 2호선 고가 상판·승강장 지붕·FaceArch 필로티 아래는 비 노출(B)을 줄이고
#      그늘(G)을 높인다. 건물 외벽 밑동 1.8 m 안쪽도 그늘(G)을 보강해 지면 AO 가 자연스럽게 어두워지게 한다.
#   2) 지면 마스크 2048 × 2048 (public/assets/nowhere/nowhere-ground-mask.webp):
#      UVMap_mask 가 덮는 MASK_RECT = (−112, −162, +162, +172) 위에서 정사영(Orthographic) 위→아래 렌더로
#      NW_GroundMask 의 출력 (R 이끼, G 젖음, B AO, A 웅덩이) 를 굽는다.
#      검수용 PNG 2장(build/nowhere/renders/t5-ground-mask-rgb.png, t5-ground-mask-puddle.png)도 함께 남긴다.
#   3) 정점 AO 굽기(Cycles): NW_present · NW_future 의 정적 메시들에 Cycles AO(target='VERTEX_COLORS')를 구워
#      nw_mask 의 B(AO) 채널에 합성하고, nw_streak(빗물 얼룩)·nw_tint(건물별 명도 변이)도 nw_mask(G·B)에 반영한다.
#      모든 정점의 nw_mask 알파(A)는 1.0 을 유지한다(§5 규약).
import bpy, os, sys, math, time, importlib
import numpy as np
from mathutils import Vector

ROOT = os.environ.get('NW_ROOT', '/Users/gm_yeonho/new-work/so/so-viewer-monster1267')
sys.dont_write_bytecode = True
_HERE = os.path.join(ROOT, 'tools', 'nowhere', 'blender')
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import lib
importlib.reload(lib)
from lib import smoothstep, clamp01

MASK_SIZE = 2048
MASK_OUT = os.path.join(ROOT, 'public', 'assets', 'nowhere', 'nowhere-ground-mask.webp')
MASK_RGB_PNG = os.path.join(lib.OUT, 'renders', 't5-ground-mask-rgb.png')
MASK_PUD_PNG = os.path.join(lib.OUT, 'renders', 't5-ground-mask-puddle.png')


def _building_rects():
    """present.py 건물 사각형 목록 [(x0, y0, x1, y1)] + HAUS + FaceArch."""
    import present
    rects = [sp['rect'] for sp in (present.BELT + present.C1 + present.E1 + present.SOUTH)]
    for (cx, cy), _ in present.APTS:
        rects.append((cx - 16.5, cy - 6.5, cx + 16.5, cy + 6.5))
    rects.append((-25.0, -25.8, 25.0, 25.8))
    return rects


def _rect_dist(x, y, r):
    x0, y0, x1, y1 = r
    dx = max(x0 - x, 0.0, x - x1)
    dy = max(y0 - y, 0.0, y - y1)
    if dx == 0.0 and dy == 0.0:
        return -min(x - x0, x1 - x, y - y0, y1 - y)
    return math.hypot(dx, dy)


def _viaduct_cover(x, y):
    """2호선 고가 상판(y 149.3..160.7) 및 성수역형 승강장 지붕(x 21.6..92.4, y 145.7..164.3) 아래 비 가림 0..1."""
    vy0, vy1 = 149.3, 160.7
    if 21.6 <= x <= 92.4:
        vy0, vy1 = 145.7, 164.3
    d = max(vy0 - y, 0.0, y - vy1)
    return 1.0 - smoothstep(0.0, 1.4, d)


def _facearch_cover(x, y):
    """FaceArch 필로티 아래(중심 105, 15, 반경 ~10 m) 비 가림 0..1."""
    d = math.hypot(x - 105.0, y - 15.0)
    return 1.0 - smoothstep(7.5, 11.5, d)


def update_ground_drive(sc):
    """NW_ground 의 nw_drive 정점 속성에 고가 하부·필로티 비 가림과 건물 밑동 AO 그늘을 반영한다."""
    G = bpy.data.collections.get('NW_ground')
    if G is None:
        return 0
    rects = _building_rects()
    updated = 0
    for o in G.all_objects:
        if o.type != 'MESH':
            continue
        me = o.data
        drv = me.color_attributes.get('nw_drive')
        if drv is None:
            continue
        n = len(me.vertices)
        buf = [0.0] * (n * 4)
        drv.data.foreach_get('color', buf)
        mw = o.matrix_world
        for i, v in enumerate(me.vertices):
            co = mw @ v.co
            x, y = co.x, co.y
            r, g, b, a = buf[4 * i : 4 * i + 4]
            vc = _viaduct_cover(x, y)
            fc = _facearch_cover(x, y)
            cov = max(vc, fc)
            if cov > 0.0:
                # 고가·필로티 아래: 직접 내리는 비(B)는 줄어들고(가장자리 물길은 남김), 그늘(G)은 깊어진다
                b = min(b, 1.0 - 0.72 * cov)
                g = max(g, 0.78 * vc + 0.65 * fc)
                r = max(r * (1.0 - 0.35 * cov), 0.32 * vc)
            # 건물 외벽 밑동 1.8 m 안쪽 그늘(AO)
            bd = min((_rect_dist(x, y, rc) for rc in rects), default=99.0)
            if bd < 1.8:
                wall_sh = (1.0 - smoothstep(0.0, 1.8, max(0.0, bd))) * 0.75
                g = max(g, wall_sh)
            buf[4 * i : 4 * i + 4] = [clamp01(r), clamp01(g), clamp01(b), clamp01(a)]
        drv.data.foreach_set('color', buf)
        if me.color_attributes.get('nw_mask') is not None:
            lib._make_render_color(me, 'nw_mask')
        updated += 1
    return updated


def _save_raw_png(name, rgba, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    h, w = rgba.shape[:2]
    im = bpy.data.images.get(name)
    if im is not None and (im.size[0] != w or im.size[1] != h):
        bpy.data.images.remove(im); im = None
    if im is None:
        im = bpy.data.images.new(name, w, h, alpha=True)
    im.pixels.foreach_set(rgba.astype(np.float32).ravel())
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


def _save_raw_webp(name, rgba, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    h, w = rgba.shape[:2]
    im = bpy.data.images.get(name)
    if im is not None:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, w, h, alpha=True)
    im.pixels.foreach_set(rgba.astype(np.float32).ravel())
    im.filepath_raw = path
    im.file_format = 'WEBP'
    im.save()
    bpy.data.images.remove(im)


def bake_ground_mask(sc, size=MASK_SIZE):
    """MASK_RECT 위에서 정사영(Orthographic) 위→아래 카메라로 NW_GroundMask 의 (Moss, Wet, AO, Puddle)을
    2048 × 2048 에 렌더해 nowhere-ground-mask.webp 로 저장한다."""
    x0, y0, x1, y1 = lib.MASK_RECT
    w_m, h_m = (x1 - x0), (y1 - y0)

    G = bpy.data.collections['NW_ground']
    gmats = sorted({s.material for o in G.all_objects if o.type == 'MESH' for s in o.material_slots if s.material},
                   key=lambda m: m.name)

    # 1) 각 지면 재질의 원래 OutputMaterial.Surface 입력 소켓과 NW_GroundMask 노드를 찾는다
    saved_links = {}
    emit_nodes = {}
    comb_nodes = {}
    for m in gmats:
        nt = m.node_tree
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
        gm = next((n for n in nt.nodes if n.type == 'GROUP' and n.node_tree and n.node_tree.name == 'NW_GroundMask'), None)
        if out is None or gm is None:
            continue
        prev = out.inputs['Surface'].links[0].from_socket if out.inputs['Surface'].links else None
        saved_links[m.name] = (out, prev, gm)
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.0
        cb = nt.nodes.new('ShaderNodeCombineColor')
        nt.links.new(gm.outputs['Moss'], cb.inputs[0])
        nt.links.new(gm.outputs['Wet'], cb.inputs[1])
        nt.links.new(gm.outputs['AO'], cb.inputs[2])
        emit_nodes[m.name] = em
        comb_nodes[m.name] = cb

    # 2) 임시 정사영 카메라 생성
    cam_data = bpy.data.cameras.new('__CAM_bake_mask')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = w_m
    cam_data.sensor_fit = 'HORIZONTAL'
    cam_data.clip_start = 0.5
    cam_data.clip_end = 120.0
    cam_obj = bpy.data.objects.new('__CAM_bake_mask', cam_data)
    sc.collection.objects.link(cam_obj)
    cam_obj.location = ((x0 + x1) * 0.5, (y0 + y1) * 0.5, 50.0)
    cam_obj.rotation_euler = (0.0, 0.0, 0.0)

    # 3) NW_ground 외 모든 컬렉션 숨김, 렌더 설정(Raw, 1 sample, 2048×2048, pixel_aspect_y = h_m/w_m)
    vis_colls = {}
    for c in bpy.data.collections:
        vis_colls[c.name] = c.hide_render
        if c.name != 'NW_ground':
            c.hide_render = True
    G.hide_render = False

    prev_cam = sc.camera
    prev_res = (sc.render.resolution_x, sc.render.resolution_y)
    prev_aspect = (sc.render.pixel_aspect_x, sc.render.pixel_aspect_y)
    prev_vt = sc.view_settings.view_transform
    prev_look = sc.view_settings.look
    prev_exp = sc.view_settings.exposure
    prev_gam = sc.view_settings.gamma
    prev_samples = sc.eevee.taa_render_samples
    prev_rt = sc.eevee.use_raytracing
    prev_sh = sc.eevee.use_shadows
    prev_world = sc.world

    # 검은 배경 월드(투명·여백 오염 방지)
    blk_w = bpy.data.worlds.new('__NW_bake_world')
    blk_w.use_nodes = True
    bg = next((n for n in blk_w.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg is not None:
        bg.inputs['Color'].default_value = (0.0, 0.35, 1.0, 1.0)
        bg.inputs['Strength'].default_value = 1.0

    tmp_rgb_path = os.path.join(lib.OUT, 'gen', '__bake_mask_rgb.png')
    tmp_pud_path = os.path.join(lib.OUT, 'gen', '__bake_mask_pud.png')

    try:
        sc.camera = cam_obj
        sc.render.resolution_x = size
        sc.render.resolution_y = size
        sc.render.pixel_aspect_x = 1.0
        sc.render.pixel_aspect_y = h_m / w_m
        sc.view_settings.view_transform = 'Raw'
        sc.view_settings.look = 'None'
        sc.view_settings.exposure = 0.0
        sc.view_settings.gamma = 1.0
        sc.eevee.taa_render_samples = 1
        sc.eevee.use_raytracing = False
        sc.eevee.use_shadows = False
        sc.world = blk_w
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGBA'

        # Pass 1: RGB = (Moss, Wet, AO)
        for mname, (out, _, _) in saved_links.items():
            nt = bpy.data.materials[mname].node_tree
            em = emit_nodes[mname]; cb = comb_nodes[mname]
            for l in list(em.inputs['Color'].links):
                nt.links.remove(l)
            nt.links.new(cb.outputs[0], em.inputs['Color'])
            for l in list(out.inputs['Surface'].links):
                nt.links.remove(l)
            nt.links.new(em.outputs[0], out.inputs['Surface'])

        lib.render(sc, cam_obj, tmp_rgb_path, res=(size, size), samples=1)

        # Pass 2: Puddle -> Emission
        if bg is not None:
            bg.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0)
        for mname, (out, _, gm) in saved_links.items():
            nt = bpy.data.materials[mname].node_tree
            em = emit_nodes[mname]
            for l in list(em.inputs['Color'].links):
                nt.links.remove(l)
            nt.links.new(gm.outputs['Puddle'], em.inputs['Color'])

        lib.render(sc, cam_obj, tmp_pud_path, res=(size, size), samples=1)

    finally:
        # 원래 재질 노드·렌더 설정 복원
        for mname, (out, prev_sock, _) in saved_links.items():
            nt = bpy.data.materials[mname].node_tree
            for l in list(out.inputs['Surface'].links):
                nt.links.remove(l)
            if prev_sock is not None:
                nt.links.new(prev_sock, out.inputs['Surface'])
            nt.nodes.remove(emit_nodes[mname])
            nt.nodes.remove(comb_nodes[mname])

        for cname, h in vis_colls.items():
            c = bpy.data.collections.get(cname)
            if c is not None:
                c.hide_render = h
        sc.camera = prev_cam
        sc.render.resolution_x, sc.render.resolution_y = prev_res
        sc.render.pixel_aspect_x, sc.render.pixel_aspect_y = prev_aspect
        sc.view_settings.view_transform = prev_vt
        sc.view_settings.look = prev_look
        sc.view_settings.exposure = prev_exp
        sc.view_settings.gamma = prev_gam
        sc.eevee.taa_render_samples = prev_samples
        sc.eevee.use_raytracing = prev_rt
        sc.eevee.use_shadows = prev_sh
        sc.world = prev_world
        bpy.data.objects.remove(cam_obj, do_unlink=True)
        bpy.data.cameras.remove(cam_data)
        bpy.data.worlds.remove(blk_w)

    # 4) 두 패스를 읽어 (R=Moss, G=Wet, B=AO, A=Puddle) 로 합치고 건물/고가 그림자 AO 보강
    im_rgb = bpy.data.images.load(tmp_rgb_path)
    im_rgb.colorspace_settings.is_data = True
    buf_rgb = np.zeros(size * size * 4, dtype=np.float32)
    im_rgb.pixels.foreach_get(buf_rgb)
    bpy.data.images.remove(im_rgb)

    im_pud = bpy.data.images.load(tmp_pud_path)
    im_pud.colorspace_settings.is_data = True
    buf_pud = np.zeros(size * size * 4, dtype=np.float32)
    im_pud.pixels.foreach_get(buf_pud)
    bpy.data.images.remove(im_pud)

    rgb = buf_rgb.reshape((size, size, 4))
    pud = buf_pud.reshape((size, size, 4))

    # 픽셀 좌표별 고가·HAUS 캔틸레버·건물 외벽 AO 보강(B 채널)
    ys = np.linspace(y0, y1, size, dtype=np.float32)[:, None]
    xs = np.linspace(x0, x1, size, dtype=np.float32)[None, :]
    # 2호선 고가 하부 AO
    in_st = (xs >= 21.6) & (xs <= 92.4)
    vy0 = np.where(in_st, 145.7, 149.3)
    vy1 = np.where(in_st, 164.3, 160.7)
    vd = np.maximum(np.maximum(vy0 - ys, 0.0), ys - vy1)
    vt = np.clip(vd / 2.2, 0.0, 1.0)
    via_ao = 0.52 + 0.48 * (vt * vt * (3.0 - 2.0 * vt))
    # HAUS 캔틸레버 하부 AO
    hd = np.maximum(np.abs(xs) - 25.15, np.abs(ys) - 25.9)
    ht = np.clip((hd + 1.0) / 2.5, 0.0, 1.0)
    haus_ao = 0.55 + 0.45 * (ht * ht * (3.0 - 2.0 * ht))

    ao_mult = np.minimum(via_ao, haus_ao)

    mask = np.zeros((size, size, 4), dtype=np.float32)
    mask[..., 0] = np.clip(rgb[..., 0], 0.0, 1.0)               # R: 이끼
    mask[..., 1] = np.clip(rgb[..., 1], 0.0, 1.0)               # G: 젖음
    mask[..., 2] = np.clip(rgb[..., 2] * ao_mult, 0.0, 1.0)     # B: AO
    mask[..., 3] = np.clip(pud[..., 0], 0.0, 1.0)               # A: 웅덩이

    # 검수용 PNG (RGB, Puddle 흑백)
    rgb_preview = np.ones((size, size, 4), dtype=np.float32)
    rgb_preview[..., :3] = mask[..., :3]
    pud_preview = np.ones((size, size, 4), dtype=np.float32)
    pud_preview[..., 0] = mask[..., 3]
    pud_preview[..., 1] = mask[..., 3]
    pud_preview[..., 2] = mask[..., 3]
    _save_raw_png('__NW_mask_rgb', rgb_preview, MASK_RGB_PNG)
    _save_raw_png('__NW_mask_pud', pud_preview, MASK_PUD_PNG)
    _save_raw_webp('__NW_mask_webp', mask, MASK_OUT)

    for p in (tmp_rgb_path, tmp_pud_path):
        if os.path.exists(p):
            os.remove(p)

    stats = {
        'size': [size, size],
        'moss_mean': round(float(mask[..., 0].mean()), 4),
        'wet_mean': round(float(mask[..., 1].mean()), 4),
        'ao_mean': round(float(mask[..., 2].mean()), 4),
        'puddle_mean': round(float(mask[..., 3].mean()), 4),
        'webp_bytes': os.path.getsize(MASK_OUT),
    }
    print('bake_ground_mask:', stats)
    return stats


def bake_vertex_ao(sc, samples=16, distance=8.0):
    """Cycles 로 정적 메시들의 정점 AO 를 구워 nw_mask 의 B 채널에 합성하고,
    nw_streak(빗물 얼룩)·nw_tint(명도 변이)도 nw_mask 에 합친다."""
    t0 = time.time()
    targets = []
    seen = set()
    for cname in ('NW_present', 'NW_future'):
        c = bpy.data.collections.get(cname)
        if c is None:
            continue
        for o in c.all_objects:
            if o.type != 'MESH' or o.hide_render or o.data in seen:
                continue
            if o.data.color_attributes.get('nw_mask') is None:
                continue
            # 월드 공간 정적 메시들과 주요 구조물에 Cycles AO 굽기
            if o.name.startswith(('PR_static_', 'PR_viaduct', 'PR_via.', 'PR_pier', 'PR_apt.0', 'FU_viaduct_led', 'FU_bridge_', 'FU_screen_', 'FU_busstop_')):
                seen.add(o.data)
                tmp = o.data.color_attributes.get('__ao') or o.data.color_attributes.new('__ao', 'FLOAT_COLOR', 'POINT')
                o.data.color_attributes.active_color = tmp
                targets.append(o)

    vis = {}
    for cname in ('NW_backdrop', 'NW_fx', 'NW_fx_night'):
        c = bpy.data.collections.get(cname)
        if c is not None:
            vis[cname] = c.hide_render
            c.hide_render = True

    try:
        sc.render.engine = 'CYCLES'
        sc.cycles.samples = samples
        sc.cycles.use_denoising = False
        if sc.world is not None:
            sc.world.light_settings.ao_factor = 1.0
            sc.world.light_settings.distance = distance
        sc.render.bake.target = 'VERTEX_COLORS'
        if targets:
            kw = dict(scene=sc, view_layer=sc.view_layers[0], active_object=targets[0], object=targets[0], selected_objects=targets)
            win = getattr(bpy.context, 'window', None)
            if win is not None:
                kw['window'] = win
            with bpy.context.temp_override(**kw):
                bpy.ops.object.bake(type='AO')
    finally:
        for cname, h in vis.items():
            c = bpy.data.collections.get(cname)
            if c is not None:
                c.hide_render = h
        lib.setup_render(sc)

    # 구운 __ao 와 nw_streak · nw_tint 를 nw_mask(R, G, B, 1.0)에 합성
    baked_meshes = 0
    for cname in ('NW_ground', 'NW_present', 'NW_future', 'NW_backdrop'):
        c = bpy.data.collections.get(cname)
        if c is None:
            continue
        done_me = set()
        for o in c.all_objects:
            if o.type != 'MESH' or o.data in done_me:
                continue
            me = o.data
            done_me.add(me)
            ca = me.color_attributes.get('nw_mask')
            if ca is None:
                continue
            n = len(me.vertices)
            vals = [0.0] * (n * 4)
            ca.data.foreach_get('color', vals)

            tmp = me.color_attributes.get('__ao')
            ao_vals = None
            if tmp is not None:
                ao_vals = [0.0] * (n * 4)
                tmp.data.foreach_get('color', ao_vals)
                me.color_attributes.remove(tmp)

            st_attr = me.attributes.get('nw_streak')
            st_vals = None
            if st_attr is not None and st_attr.domain == 'POINT' and st_attr.data_type == 'FLOAT':
                st_vals = [0.0] * n
                st_attr.data.foreach_get('value', st_vals)

            tn_attr = me.attributes.get('nw_tint')
            tn_vals = None
            if tn_attr is not None and tn_attr.domain == 'POINT' and tn_attr.data_type == 'FLOAT2':
                tn_vals = [0.0] * (n * 2)
                tn_attr.data.foreach_get('vector', tn_vals)

            if ao_vals is not None or st_vals is not None or tn_vals is not None:
                for i in range(n):
                    r, g, b, _ = vals[4 * i : 4 * i + 4]
                    if ao_vals is not None:
                        cyc_ao = clamp01(ao_vals[4 * i])
                        b = min(b, 0.25 + 0.75 * cyc_ao) * (0.65 + 0.35 * cyc_ao)
                    if st_vals is not None:
                        st = clamp01(st_vals[i])
                        g = clamp01(g + 0.22 * st)
                        b = clamp01(b * (1.0 - 0.18 * st))
                    if tn_vals is not None:
                        tv = tn_vals[2 * i + 1]
                        b = clamp01(b * (1.0 + 0.06 * tv))
                    vals[4 * i : 4 * i + 4] = [clamp01(r), clamp01(g), clamp01(b), 1.0]
                ca.data.foreach_set('color', vals)
                baked_meshes += 1
            lib._make_render_color(me, 'nw_mask')

    print('bake_vertex_ao:', len(targets), 'Cycles AO targets,', baked_meshes, 'meshes updated in', round(time.time() - t0, 2), 's')
    return {'cycles_targets': len(targets), 'updated_meshes': baked_meshes}


def bake():
    t0 = time.time()
    sc = lib.get_scene(True)
    lib.apply_mood(sc, 'overcast', bake=False)
    nd = update_ground_drive(sc)
    print('updated ground nw_drive meshes:', nd)
    gm = bake_ground_mask(sc, MASK_SIZE)
    vao = bake_vertex_ao(sc)
    lib.bake_light_probes(sc)
    print('bake complete in', round(time.time() - t0, 1), 's')
    return {'ground_drive_meshes': nd, 'ground_mask': gm, 'vertex_ao': vao}


if __name__ == '__main__':
    bake()
