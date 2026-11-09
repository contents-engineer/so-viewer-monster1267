# HAUS NOWHERE — 성수 실내 층 정의(배치 값 · 둘러보기 · 전시)와 층별 배치 함수. inner_build.py 가 FLOORS 를 차례로 빌드한다.
# Blender 좌표(Z-up m). 층 JSON 은 inner_common.floor_json 이 Three 좌표로 바꾼다.
from inner_common import box, plane, import_prop, ribbon, curtain, elevator_core, columns

# ═════════════ 1F 로비 ═════════════
# Blender 평면: x −17…17, y −17…21(남측 y −17 정문, 북측 y +21 엘리베이터 코어), 층고 6 m.
FLOOR_1 = {
    'id': '1', 'label': '1F 로비',
    'glb': 'assets/nowhere-inner/inner-1.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-1.glb',
    'elevation': 0.0, 'bounds_bl': (-17.0, -17.0, 17.0, 21.0), 'ceiling': 6.0,
    'floor_tex': {'dir': 'main', 'diffuse': 'floor_diffuse.png', 'normal': 'floor_normal.png', 'tile': 1.2, 'rough': 0.35},
    'entry': ((0.0, -13.0, 1.7), (0.0, 0.0, 2.5)),
    'spawn': ((0.0, 15.0, 1.7), (0.0, 0.0, 2.5)),
    'exit': ((0.0, -16.0, 0.0), 2.0),
    'elevator': ((0.0, 19.0, 0.0), 2.5),
    'exhibits': [
        ('city_model', '성수 도시 모형', 'HAUS NOWHERE 미니어처와 성수의 그래피티 건물들', (0.0, 0.0, 1.5)),
        ('dj', 'DJ 부스', '로비의 사운드 설치물', (8.8, 7.2, 1.2)),
        ('display', '디스플레이 월', 'HAUS NOWHERE SEOUL · 현재 시각 · 기상', (-16.4, 6.0, 2.4)),
    ],
    'tour': [
        ((6.0, -8.0, 2.2), (0.0, 0.0, 1.8), '성수 도시 모형 — HAUS NOWHERE 와 성수 골목', 5),
        ((4.0, 3.0, 1.8), (8.8, 7.2, 1.2), 'DJ 부스 — 로비의 사운드 설치물', 4),
        ((-8.0, 2.0, 2.4), (-16.4, 6.0, 2.4), '디스플레이 월', 4),
    ],
}


def build_floor_1(c, M):
    X0, Y0, X1, Y1 = FLOOR_1['bounds_bl']
    H = FLOOR_1['ceiling']
    T = 0.3
    plane('IN_floor', c, X0 - T, Y0 - T, X1 + T, Y1 + T, 0.0, M['floor'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    # 남측: 정문 열림(x −3…3, z 0…3.4) 양옆 띠창 + 문 위 인방 · 유리 · 벽
    ribbon(c, M, 'sw', X0 - T, Y0 - T, -3.0, Y0, H)
    ribbon(c, M, 'se', 3.0, Y0 - T, X1 + T, Y0, H)
    box('IN_wall_s_lintel', c, -3.0, Y0 - T, 3.4, 3.0, Y0, 3.6, M['concrete'])
    box('IN_glass_s_top', c, -3.0, Y0 - T, 3.6, 3.0, Y0, 5.0, M['glass'])
    box('IN_wall_s_top', c, -3.0, Y0 - T, 5.0, 3.0, Y0, H, M['concrete'])
    # 서 · 동: 띠창, 북: 막힌 벽 + 엘리베이터 코어
    ribbon(c, M, 'w', X0 - T, Y0, X0, Y1, H)
    ribbon(c, M, 'e', X1, Y0, X1 + T, Y1, H)
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    elevator_core(c, M, 19.5, Y1, H)
    columns(c, M, ((-11.0, -6.0), (11.0, -6.0), (-11.0, 9.0), (11.0, 9.0)), H)
    # 성수 도시 모형: 받침대(높이 0.8 m) 위 HAUS NOWHERE 미니어처 + 그래피티 건물 3종
    box('EX_plinth', c, -4.5, -3.0, 0.0, 4.5, 3.0, 0.8, M['plinth'])
    P = 0.8
    import_prop('main/office_building.glb', 'EX_city_haus', c, (0.0, 0.0, P), height=3.0)
    import_prop('etc/building_1.glb', 'EX_city_b1', c, (-2.9, -1.2, P), height=1.6, rz=-90)
    import_prop('etc/building_2.glb', 'EX_city_b2', c, (2.9, -1.5, P), height=1.4, rz=90)
    import_prop('etc/building_3.glb', 'EX_city_b3', c, (2.8, 1.7, P), height=1.9, rz=180)
    import_prop('main/DJ.glb', 'EX_dj', c, (8.8, 7.2, 0.0), height=2.4, rz=-45)
    import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)


# 빌드 순서 = inner-layout.json 의 floors 순서
FLOORS = [
    (FLOOR_1, build_floor_1),
]
