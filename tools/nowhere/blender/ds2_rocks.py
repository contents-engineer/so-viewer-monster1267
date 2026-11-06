# HAUS NOWHERE — DS2 산악 월드: 빙하 계곡 표석(erratic boulder) 생성기.
# 참조 화면(좁은 U자 계곡 바닥에 흩어진 회색 바위)의 바위는 상자형 주상절리가 아니라
# "둥근 덩어리 + 몇 개의 평평한 파쇄면 + 납작한 바닥"을 가진 화강암·편마암 표석이다.
# ds2_present(근경 바위 들판)와 ds2_backdrop(계곡 바닥 암괴 tor)가 함께 쓴다.
import bmesh, math, random
from mathutils import Vector, noise


def boulder_geom(seed, subdiv=2, cuts=5, squash=0.72, lump=0.22, bottom=0.2):
    """단위 반경 표석 메시. 반환 (V, F, h): 바닥 z = 0, 높이 h.

    1) 이코스피어 → 2) 저주파 노이즈로 둥근 굴곡 → 3) 무작위 평면 절단(파쇄면, 날카로운 모서리)
    → 4) 바닥 납작화(땅에 박힌 하부)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off1 = Vector((rnd.uniform(-60, 60), rnd.uniform(-60, 60), rnd.uniform(-60, 60)))
    off2 = Vector((rnd.uniform(-60, 60), rnd.uniform(-60, 60), rnd.uniform(-60, 60)))
    sx, sy = rnd.uniform(0.88, 1.28), rnd.uniform(0.72, 1.06)
    planes = []
    for _ in range(cuts):
        a = rnd.uniform(0.0, 2.0 * math.pi)
        el = rnd.uniform(-0.2, 0.95)          # 수평~위쪽 사선 파쇄면 위주(윗면이 평평한 판석 실루엣)
        n = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        planes.append((n, rnd.uniform(0.58, 0.86)))
    for v in bm.verts:
        p = v.co.normalized()
        r = 1.0 + lump * noise.noise(p * 1.35 + off1) + 0.075 * noise.noise(p * 3.4 + off2)
        q = Vector((p.x * r * sx, p.y * r * sy, p.z * r * squash))
        for n, d in planes:
            s = q.dot(n)
            if s > d:
                q -= n * (s - d)
        v.co = q
    zs = [v.co.z for v in bm.verts]
    zmin, zmax = min(zs), max(zs)
    zcut = zmin + bottom * (zmax - zmin)
    for v in bm.verts:
        if v.co.z < zcut:
            v.co.z = zcut + (v.co.z - zcut) * 0.12
        v.co.z -= zcut
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    V = [tuple(v.co) for v in bm.verts]
    idx = {v: i for i, v in enumerate(bm.verts)}
    F = [tuple(idx[v] for v in f.verts) for f in bm.faces]
    h = max(c[2] for c in V)
    bm.free()
    return V, F, h


def boulder_mask(h, moss_amt=0.95, seed=0.0):
    """정점 마스크 (R 이끼, G 젖음, B AO, A 빗물 줄무늬): 위를 향한 면·윗부분에 이끼 모자,
    아랫부분은 젖고 어둡다. 참조 화면의 '윗면에만 이끼가 앉은 회색 바위'."""
    def mk(p, n):
        z = p[2]
        top = max(0.0, min(1.0, (n[2] - 0.45) / 0.4))
        upper = max(0.0, min(1.0, (z / max(h, 1e-3) - 0.35) / 0.45))
        nz = 0.5 + 0.5 * noise.noise(Vector((p[0] * 0.9 + seed, p[1] * 0.9, z * 0.9)))
        moss = max(0.0, min(1.0, moss_amt * top * (0.35 + 0.65 * upper) * (0.55 + 0.75 * nz)))
        low = 1.0 - max(0.0, min(1.0, z / max(0.35 * h, 1e-3)))
        wet = 0.32 + 0.5 * low
        ao = 1.0 - 0.55 * low
        streak = 0.35 * (1.0 - top) * upper
        return (moss, wet, ao, streak)
    return mk
