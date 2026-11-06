# HAUS NOWHERE — DS2 산악 월드: 참조 화면(빙하 계곡 역광 헤이즈) 조명·하늘·대기 룩.
# 참조 화면의 읽기: 해는 오른쪽 위(계곡 상류 북북동) 암벽 너머 낮은 고도에 있고, 그 주변 하늘이 하얗게 번지며
# (태양 헤이즈 + 무지개빛 플레어), 계곡 안 공기는 회청색 연무로 원경 암벽을 밝게 지운다. 근경은 역광이라 어둡고 대비가 강하다.
# 웹(public/src/nowhere/weather.js 의 DS2 프리셋, sky.js 태양 헤이즈)도 같은 태양 방향·색을 쓴다.
import bpy, math
from lib import srgb

SUN_AZIMUTH = 32.0        # 장면 방위(+Y = 북 = 0°, 시계 방향)
SUN_ELEVATION = 26.0
SUN_ENERGY = 3.0
SUN_COLOR = '#FFF0DC'
SKY_HORIZON = '#C9CECD'
SKY_ZENITH = '#9FA8AB'
GROUND_COL = '#2C302C'
FOG_NEAR = '#AEB6B8'
FOG_FAR = '#C8CED0'


def sun_dir():
    az, el = math.radians(SUN_AZIMUTH), math.radians(SUN_ELEVATION)
    return (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))


def sun_dir_three():
    x, y, z = sun_dir()
    return [round(x, 4), round(z, 4), round(-y, 4)]


def _world():
    w = bpy.data.worlds.get('NW_World') or bpy.data.worlds.new('NW_World')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links

    def node(t, **kw):
        n = N.new(t)
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    def vmath(op, a, b=None):
        n = node('ShaderNodeVectorMath', operation=op)
        L.new(a, n.inputs[0])
        if b is not None:
            if isinstance(b, tuple):
                n.inputs[1].default_value = b
            else:
                L.new(b, n.inputs[1])
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH') else n.outputs['Vector']

    def math_(op, a, b):
        n = node('ShaderNodeMath', operation=op)
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]

    out = node('ShaderNodeOutputWorld')
    tc = node('ShaderNodeTexCoord')
    d = vmath('NORMALIZE', tc.outputs['Generated'])
    sep = node('ShaderNodeSeparateXYZ')
    L.new(d, sep.inputs[0])
    z = sep.outputs['Z']

    # 하늘 그라데이션(지평선 → 천정)
    ramp = node('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position = 0.0; el[0].color = srgb(SKY_HORIZON)
    el[1].position = 0.6; el[1].color = srgb(SKY_ZENITH)
    L.new(math_('POWER', math_('MAXIMUM', z, 0.0), 0.7), ramp.inputs['Fac'])

    # 태양 헤이즈: 넓은 번짐 + 좁은 코로나 + 해 원반
    cosv = math_('MAXIMUM', vmath('DOT_PRODUCT', d, tuple(sun_dir())), 0.0)
    glow = math_('ADD', math_('ADD', math_('MULTIPLY', math_('POWER', cosv, 6.0), 0.45),
                                  math_('MULTIPLY', math_('POWER', cosv, 48.0), 0.9)),
                 math_('MULTIPLY', math_('POWER', cosv, 2400.0), 6.0))
    sun_c = node('ShaderNodeRGB'); sun_c.outputs[0].default_value = srgb(SUN_COLOR)
    scale = node('ShaderNodeVectorMath', operation='SCALE')
    L.new(sun_c.outputs[0], scale.inputs[0]); L.new(glow, scale.inputs['Scale'])
    add = node('ShaderNodeVectorMath', operation='ADD')
    L.new(ramp.outputs['Color'], add.inputs[0]); L.new(scale.outputs['Vector'], add.inputs[1])

    # 지평선 아래는 어두운 계곡 바닥색
    below = node('ShaderNodeMapRange')
    below.inputs['From Min'].default_value = 0.0; below.inputs['From Max'].default_value = -0.12
    L.new(z, below.inputs['Value'])
    mix_g = node('ShaderNodeMix', data_type='RGBA')
    L.new(below.outputs['Result'], mix_g.inputs['Factor'])
    L.new(add.outputs['Vector'], mix_g.inputs[6])
    mix_g.inputs[7].default_value = srgb(GROUND_COL)

    cam_bg = node('ShaderNodeBackground'); cam_bg.inputs['Strength'].default_value = 1.15
    L.new(mix_g.outputs[2], cam_bg.inputs['Color'])
    # 조명·반사용: 같은 하늘(해 원반 제외 효과는 sun 램프가 맡는다)
    light_mix = node('ShaderNodeMix', data_type='RGBA')
    L.new(below.outputs['Result'], light_mix.inputs['Factor'])
    L.new(ramp.outputs['Color'], light_mix.inputs[6])
    light_mix.inputs[7].default_value = srgb(GROUND_COL)
    light_bg = node('ShaderNodeBackground'); light_bg.inputs['Strength'].default_value = 1.25
    L.new(light_mix.outputs[2], light_bg.inputs['Color'])
    lp = node('ShaderNodeLightPath')
    mix = node('ShaderNodeMixShader')
    L.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    L.new(light_bg.outputs[0], mix.inputs[1]); L.new(cam_bg.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    try:
        w.sun_threshold = 50.0
    except Exception:
        pass
    return w


def apply(sc):
    """흐림(overcast) 무드 위에 DS2 역광 헤이즈 룩을 덮어쓴다(lib.apply_mood(sc, 'overcast') 직후 호출)."""
    sc.world = _world()
    sun = bpy.data.objects.get('FX_sun')
    if sun is not None:
        az, el = math.radians(SUN_AZIMUTH), math.radians(SUN_ELEVATION)
        sun.rotation_euler = (math.pi / 2 - el, 0.0, math.pi - az)
        sun.data.energy = SUN_ENERGY
        sun.data.angle = math.radians(2.5)
        sun.data.color = srgb(SUN_COLOR)[:3]
        sun.hide_render = False
        sun.hide_viewport = False
    fm = bpy.data.materials.get('NW_fog')
    if fm is not None and fm.node_tree is not None:
        Nn = fm.node_tree.nodes
        if Nn.get('nw_fog_near'):
            Nn['nw_fog_near'].outputs[0].default_value = srgb(FOG_NEAR)
        if Nn.get('nw_fog_far'):
            Nn['nw_fog_far'].outputs[0].default_value = srgb(FOG_FAR)
        if Nn.get('nw_fog_mult'):
            Nn['nw_fog_mult'].outputs[0].default_value = 0.8
        vol = Nn.get('nw_fog_vol')
        if vol is not None:
            vol.inputs['Anisotropy'].default_value = 0.6      # 해 쪽으로 밝게 번지는 전방 산란
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    sc.view_settings.exposure = 0.15
    return sc.world
