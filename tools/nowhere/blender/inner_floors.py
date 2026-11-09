# HAUS NOWHERE — 성수 실내 층 정의(배치 값 · 둘러보기 · 전시)와 층별 배치 함수. inner_build.py 가 FLOORS 를 차례로 빌드한다.
# Blender 좌표(Z-up m). 층 JSON 은 inner_common.floor_json 이 Three 좌표로 바꾼다.
from inner_common import box, plane, import_prop, ribbon, curtain, elevator_core, columns, display_screen

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
    disp = import_prop('main/display.glb', 'EX_display', c, (-16.4, 6.0, 0.0), width=6.0, rz=90)
    display_screen(disp, c, M['screen'])


# ═════════════ B1F 카페 ═════════════
# Blender 평면: x −13…13, y −13…13, 층고 4 m, 창 없음(지하). 북측 엘리베이터 코어(앞면 y 11.5).
FLOOR_B1 = {
    'id': 'b1', 'label': 'B1F 카페',
    'glb': 'assets/nowhere-inner/inner-b1.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-b1.glb',
    'elevation': -4.5, 'bounds_bl': (-13.0, -13.0, 13.0, 13.0), 'ceiling': 4.0,
    'floor_tex': {'dir': 'b1f', 'diffuse': 'floor_b1_diffuse.png', 'normal': 'floor_b1_normal.png', 'tile': 1.5, 'rough': 0.85},
    'spawn': ((0.0, 7.5, 1.7), (0.0, 0.0, 1.5)),
    'elevator': ((0.0, 11.0, 0.0), 2.5),
    'exhibits': [
        ('cafe', '지하 카페', '테이블 여섯 개와 버섯 몬스터 손님', (0.0, -2.5, 1.0)),
    ],
    'tour': [
        ((-9.0, -10.0, 2.0), (0.0, -2.5, 0.8), '지하 카페 — 버섯 몬스터 손님이 앉은 테이블', 5),
        ((9.0, -10.0, 2.2), (3.5, 4.0, 0.9), '버섯 손님 — 오늘의 주문을 기다리는 중', 4),
    ],
}
TABLES_B1 = ((-7.0, -6.0), (0.0, -6.0), (7.0, -6.0), (-7.0, 1.0), (0.0, 1.0), (7.0, 1.0))


def build_floor_b1(c, M):
    X0, Y0, X1, Y1 = FLOOR_B1['bounds_bl']
    H = FLOOR_B1['ceiling']
    T = 0.3
    plane('IN_floor', c, X0 - T, Y0 - T, X1 + T, Y1 + T, 0.0, M['floor'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    # 지하라 창 없는 콘크리트 벽
    box('IN_wall_s', c, X0 - T, Y0 - T, 0.0, X1 + T, Y0, H, M['concrete'])
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    box('IN_wall_w', c, X0 - T, Y0, 0.0, X0, Y1, H, M['concrete'])
    box('IN_wall_e', c, X1, Y0, 0.0, X1 + T, Y1, H, M['concrete'])
    elevator_core(c, M, 11.5, Y1, H)
    columns(c, M, ((-10.5, 0.0), (10.5, 0.0)), H)
    for i, (x, y) in enumerate(TABLES_B1):
        import_prop('b1f/table.glb', f'EX_table_{i}', c, (x, y, 0.0), height=0.75, rz=0.0)
    import_prop('etc/Mushroom.glb', 'EX_guest_0', c, (-3.5, -2.5, 0.0), height=1.2, rz=0.0)
    import_prop('etc/Monster1_room.glb', 'EX_guest_1', c, (3.5, 4.0, 0.0), height=1.2, rz=180.0)


# ═════════════ 타워 층 공용 껍데기 ═════════════
# 타워 평면: x −15…15, y −11…11. 남 · 동 · 서 커튼월(외관 타워의 유리 커튼월), 북측 콘크리트 벽 + 엘리베이터 코어(앞면 y 9.5), 기둥 2개.
def tower_shell(c, M, F):
    X0, Y0, X1, Y1 = F['bounds_bl']
    H = F['ceiling']
    T = 0.3
    plane('IN_floor', c, X0 - T, Y0 - T, X1 + T, Y1 + T, 0.0, M['floor'])
    box('IN_ceiling', c, X0 - T, Y0 - T, H, X1 + T, Y1 + T, H + 0.2, M['ceiling'])
    curtain(c, M, 's', X0 - T, Y0 - T, X1 + T, Y0, H)
    curtain(c, M, 'w', X0 - T, Y0, X0, Y1, H)
    curtain(c, M, 'e', X1, Y0, X1 + T, Y1, H)
    box('IN_wall_n', c, X0 - T, Y1, 0.0, X1 + T, Y1 + T, H, M['concrete'])
    elevator_core(c, M, 9.5, Y1, H)
    columns(c, M, ((-7.5, 2.0), (7.5, 2.0)), H)


# ═════════════ 12F ═════════════
FLOOR_12 = {
    'id': '12', 'label': '12F',
    'glb': 'assets/nowhere-inner/inner-12.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-12.glb',
    'elevation': 55.0, 'bounds_bl': (-15.0, -11.0, 15.0, 11.0), 'ceiling': 4.2,
    'floor_tex': {'dir': '12f', 'diffuse': 'floor_12_diffuse.png', 'normal': 'floor_12_normal.png', 'tile': 2.0, 'rough': 0.9},
    'spawn': ((0.0, 6.0, 1.7), (0.0, -4.0, 1.7)),
    'elevator': ((0.0, 9.0, 0.0), 2.5),
    'exhibits': [
        ('cowboy', '카우보이 디오라마', '받침대 위 서부 마을 디오라마', (-6.0, -2.0, 1.5)),
        ('smoking', '흡연 부스', '커튼월 앞 흡연 부스', (8.0, -3.0, 1.2)),
        ('portal', '붉은 커튼 포털', '석조 포털과 붉은 커튼', (-10.0, 10.1, 1.6)),
    ],
    'tour': [
        ((-1.0, -7.0, 2.0), (-6.0, -2.0, 1.2), '카우보이 디오라마 — 받침대 위 서부 마을', 5),
        ((3.0, -8.0, 1.8), (8.0, -3.0, 1.2), '흡연 부스 — 커튼월 너머 성수', 4),
        ((-5.0, 4.0, 1.8), (-10.0, 10.1, 1.6), '붉은 커튼 포털', 4),
    ],
}


def build_floor_12(c, M):
    tower_shell(c, M, FLOOR_12)
    box('EX_plinth_cowboy', c, -8.5, -4.5, 0.0, -3.5, 0.5, 0.6, M['plinth'])
    import_prop('12f/Cowboy.glb', 'EX_cowboy', c, (-6.0, -2.0, 0.6), width=4.0, rz=0.0)
    import_prop('12f/Smoking.glb', 'EX_smoking', c, (8.0, -3.0, 0.0), height=2.1, rz=0.0)
    # 포털 깊이 1.66 m — y 10.4 면 뒤쪽이 북쪽 벽(y 11)에 0.23 m 박혀서 10.1 로 당김(벽까지 7 cm)
    import_prop('12f/door_2.glb', 'EX_portal', c, (-10.0, 10.1, 0.0), height=2.9, rz=0.0)


# ═════════════ 13F 몬스터 룸 ═════════════
FLOOR_13 = {
    'id': '13', 'label': '13F 몬스터 룸',
    'glb': 'assets/nowhere-inner/inner-13.glb', 'mobileGlb': 'assets/nowhere-inner/mobile/inner-13.glb',
    'elevation': 60.0, 'bounds_bl': (-15.0, -11.0, 15.0, 11.0), 'ceiling': 4.2,
    'floor_tex': {'dir': '13f', 'diffuse': 'floor_13_diffuse.png', 'normal': 'floor_13_normal.png', 'tile': 2.0, 'rough': 0.3},
    'spawn': ((0.0, 6.0, 1.7), (0.0, -4.0, 1.7)),
    'elevator': ((0.0, 9.0, 0.0), 2.5),
    'exhibits': [
        ('nail', '거대한 손', '네일 아트를 한 높이 4 m 의 손', (-6.0, -4.0, 2.0)),
        ('sphinx', '스핑크스', '길이 3.8 m 의 스핑크스', (6.0, -4.0, 1.2)),
        ('monsters', '버섯 몬스터', '이름 명판 받침대 위의 버섯 몬스터 네 종', (0.0, 4.0, 1.0)),
    ],
    'tour': [
        ((-1.0, -9.0, 2.2), (-6.0, -4.0, 2.0), '거대한 손 — 네일 아트를 한 4 m 손', 5),
        ((1.0, -9.0, 1.8), (6.0, -4.0, 1.0), '스핑크스', 4),
        ((0.0, 0.5, 1.8), (-9.25, 4.0, 1.0), '버섯 몬스터 — 이름 명판 받침대', 5),
    ],
}
# (에셋, x) — 북쪽 줄 y 4.0, 받침대 1.4 × 1.4 × 0.4 m, 앞면(−y)에 황동 명판
MONSTERS_13 = (
    ('etc/Monster1_room.glb', -11.0),
    ('etc/Monster849_room.glb', -7.5),
    ('etc/Monster1083_room.glb', 7.5),
    ('etc/Mushroom.glb', 11.0),
)


def build_floor_13(c, M):
    tower_shell(c, M, FLOOR_13)
    # 원본은 손톱(네일 아트) 면이 −x(서쪽 커튼월) · 스핑크스 얼굴이 −y(남쪽 커튼월)를 봐서 둘 다 방 가운데 쪽으로 돌림
    import_prop('13f/nail.glb', 'EX_nail', c, (-6.0, -4.0, 0.0), height=4.0, rz=180.0)
    import_prop('13f/sphinx.glb', 'EX_sphinx', c, (6.0, -4.0, 0.0), width=3.8, rz=-90.0)
    for i, (rel, x) in enumerate(MONSTERS_13):
        box(f'EX_plinth_m{i}', c, x - 0.7, 3.3, 0.0, x + 0.7, 4.7, 0.4, M['plinth'])
        box(f'EX_nameplate_m{i}', c, x - 0.35, 3.26, 0.12, x + 0.35, 3.3, 0.3, M['brass'])
        import_prop(rel, f'EX_monster_{i}', c, (x, 4.0, 0.4), height=1.6, rz=180.0)


# 빌드 순서 = inner-layout.json 의 floors 순서
FLOORS = [
    (FLOOR_B1, build_floor_b1),
    (FLOOR_1, build_floor_1),
    (FLOOR_12, build_floor_12),
    (FLOOR_13, build_floor_13),
]
